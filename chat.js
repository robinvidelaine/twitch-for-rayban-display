"use strict";
// No Player reference: this component only receives chat data and changes visibility.
class ReadOnlyChat {
  constructor(element) {
    this.element=element; this.mode='off'; this.version=0; this.sockets=new Set(); this.seen=new Set();
    auth.on(d=>{if(!d.user)this.stop()});
  }
  setMode(mode) { this.mode=mode; this.element.hidden=mode==='off'; }
  stop() { this.version++; clearTimeout(this.retry); this.sockets.forEach(s=>s.close());this.sockets.clear();this.channel=null;this.seen.clear();this.element.replaceChildren(); }
  watch(id) { if(this.channel===id&&this.sockets.size)return;this.stop();this.channel=id;this.attempt=0;this.notice('Connexion au chat…');this.connect(this.version); }
  notice(text) { let p=this.element.querySelector('.chat-status');if(!p){p=document.createElement('p');p.className='chat-status';this.element.prepend(p)}p.textContent=text; }
  connect(version,url='wss://eventsub.wss.twitch.tv/ws',previous=null) {
    if(version!==this.version||!auth.user())return;
    const endpoint=new URL(url);if(endpoint.protocol!=='wss:'||endpoint.hostname!=='eventsub.wss.twitch.tv')return;
    const socket=new WebSocket(url);this.sockets.add(socket);let transferred=false,timer,timeout=15;
    const watchdog=()=>{clearTimeout(timer);timer=setTimeout(()=>socket.close(),(timeout+5)*1000)};
    socket.onmessage=async({data})=>{
      if(version!==this.version)return;
      let packet;try{packet=JSON.parse(data)}catch{return}watchdog();
      const type=packet.metadata.message_type;
      if(type==='session_welcome') {
        timeout=packet.payload.session.keepalive_timeout_seconds||15;watchdog();
        if(previous){previous.close();this.notice('Chat connecté');return}
        try {
          for(const type of ['channel.chat.message','channel.chat.message_delete','channel.chat.clear','channel.chat.clear_user_messages']) {
            if(version!==this.version)return;
            await helix('eventsub/subscriptions',{}, {method:'POST',body:JSON.stringify({type,version:'1',condition:{broadcaster_user_id:this.channel,user_id:auth.user().id},transport:{method:'websocket',session_id:packet.payload.session.id}})});
          }
          this.attempt=0;this.notice('Chat connecté — lecture seule');
        }catch(error){if(version!==this.version)return;this.notice(error.message);transferred=true;socket.close()}
      } else if(type==='session_reconnect') { transferred=true;this.connect(version,packet.payload.session.reconnect_url,socket);
      } else if(type==='revocation') {this.notice('Autorisation chat révoquée. Reconnectez-vous.');transferred=true;socket.close();
      } else if(type==='notification') {
        const id=packet.metadata.message_id;if(this.seen.has(id))return;this.seen.add(id);if(this.seen.size>500)this.seen.delete(this.seen.values().next().value);
        this.message(packet.payload.subscription.type,packet.payload.event);
      }
    };
    socket.onclose=()=>{clearTimeout(timer);this.sockets.delete(socket);if(version!==this.version||transferred)return;this.notice('Chat déconnecté. Reconnexion…');this.retry=setTimeout(()=>this.connect(version),Math.min(30000,1000*2**this.attempt++))};
    socket.onerror=()=>{if(version===this.version)this.notice('Connexion chat indisponible.')};watchdog();
  }
  message(type,event) {
    const rows=[...this.element.querySelectorAll('.chat-message')];
    if(type!=='channel.chat.message'){rows.forEach(row=>{if(type==='channel.chat.clear'||row.dataset.message===event.message_id||row.dataset.user===event.target_user_id)row.remove()});return}
    const row=document.createElement('p');row.className='chat-message';row.dataset.message=event.message_id;row.dataset.user=event.chatter_user_id;
    const name=document.createElement('strong');name.textContent=event.chatter_user_name+' : ';if(/^#[0-9a-f]{6}$/i.test(event.color))name.style.color=event.color;
    row.append(name,document.createTextNode(event.message.text));this.element.append(row);
    while(this.element.querySelectorAll('.chat-message').length>100)this.element.querySelector('.chat-message').remove();this.element.scrollTop=this.element.scrollHeight;
  }
}
