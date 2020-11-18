//フォルダー：sample-thai
const express = require('express');
const app = express();
const line = require('@line/bot-sdk');
const PORT = process.env.PORT || 5000

const config = {
   channelAccessToken:process.env.ACCESS_TOKEN,
   channelSecret:process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

app
   .post('/hook',line.middleware(config),(req,res)=> lineBot(req,res))
   .listen(PORT,()=>console.log(`Listening on ${PORT}`));

//lineBot関数（イベントタイプによって実行関数を振り分け）
const lineBot = (req,res) => {
    res.status(200).end();
    const events = req.body.events;
    const promises = [];
    for(let i=0;i<events.length;i++){
        const ev = events[i];
        switch(ev.type){
            case 'follow'://友達登録で発火
                promises.push(greeting_follow(ev));
                break;
            case 'message'://メッセージが送られてきたら発火
                promises.push(handleMessageEvent(ev));
                break;
            
        }
    }
    Promise
        .all(promises)
        .then(console.log('all promises passed'))
        .catch(e=>console.error(e.stack));
 }
 //greeting_follow関数(友達登録時の処理)
 const greeting_follow = async (ev) => {
    const profile = await client.getProfile(ev.source.userId);
    return client.replyMessage(ev.replyToken,{
        "type":"text",
        "text":`${profile.displayName}さん、友達登録ありがとうございます\uDBC0\uDC04\n\nタイマッサージ店〇〇です\n\nご予約お待ちしております\uDBC0\uDC01\uDBC0\uDC2D\uDBC0\uDC2D`
    });
 }
 //handleMessageEvent関数（メッセージが送られてきた時の処理振り分け）
 const handleMessageEvent = async (ev) => {
    const profile = await client.getProfile(ev.source.userId);
    const text = (ev.message.type === 'text') ? ev.message.text : '';
    
    return client.replyMessage(ev.replyToken,{
        "type":"text",
        "wrap": true,
        "text":`${profile.displayName}さん\nメッセージありがとうございます。\n\n申し訳ございませんが、このアカウントでは個別の返信をしておりません。\n\n＜お問い合わせ＞\nご質問などお問い合わせは店舗にお願いします。\nhttps://tsukumonetwork.co.jp/`
    });
 }