//フォルダー：sample-thai
const express = require('express');
const app = express();
const line = require('@line/bot-sdk');
const { Client } = require('pg');
const connection = new Client({
    user:process.env.PG_USER,
    host:process.env.PG_HOST,
    database:process.env.PG_DATABASE,
    password:process.env.PG_PASSWORD,
    port:5432
  });
 connection.connect();
const PORT = process.env.PORT || 5000

const config = {
   channelAccessToken:process.env.ACCESS_TOKEN,
   channelSecret:process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

app
   .post('/hook',line.middleware(config),(req,res)=> lineBot(req,res))
   .listen(PORT,()=>console.log(`Listening on ${PORT}`));
//顧客データベース作成
const create_userTable = {
    text:'CREATE TABLE IF NOT EXISTS users (id SERIAL NOT NULL, line_uid VARCHAR(255), display_name VARCHAR(255), timestamp VARCHAR(255));'
 };
 connection.query(create_userTable)
   .then(()=>{
       console.log('table users created successfully!!');
   })
   .catch(e=>console.log(e));
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
            case 'postback'://ボタンが押されたらdataの値を返す
                promises.push(handlePostbackEvent(ev));
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
    const table_insert = {
        text:'INSERT INTO users (line_uid,display_name,timestamp) VALUES($1,$2,$3);',
        values:[ev.source.userId,profile.displayName,ev.timestamp]
      };
      connection.query(table_insert)
        .then(()=>{
           console.log('insert successfully!!')
         })
        .catch(e=>console.log(e));
    return client.replyMessage(ev.replyToken,{
        "type":"text",
        "text":`${profile.displayName}さん、友達登録ありがとうございます\uDBC0\uDC04\n\nタイマッサージ店〇〇です\n\nご予約お待ちしております\uDBC0\uDC01\uDBC0\uDC2D\uDBC0\uDC2D`
    });
 }
//handleMessageEvent関数（メッセージが送られてきた時の処理振り分け）
 const handleMessageEvent = async (ev) => {
    console.log('ev:',ev);
    const profile = await client.getProfile(ev.source.userId);
    const text = (ev.message.type === 'text') ? ev.message.text : '';
    
    if(text === '予約する'){
        orderChoice(ev);
    }else{
        return client.replyMessage(ev.replyToken,{
            "type":"text",
            "text":`${profile.displayName}さん\nメッセージありがとうございます。\n\n申し訳ございませんが、このアカウントでは個別の返信をしておりません。\n\n＜お問い合わせ＞\nご質問などお問い合わせは店舗にお願いします。\nhttps://tsukumonetwork.co.jp/`
        });
    }
}
 //handlePostbackEvent関数（イベントタイプ"postback"の処理振り分け）
 const handlePostbackEvent = async (ev) => {
    const profile = await client.getProfile(ev.source.userId);
    const data = ev.postback.data;
    const splitData = data.split('&');

    if(splitData[0] === 'menu'){
        const orderedMenu = splitData[1];//メニュー取得
        console.log('menuのsplitData = ', splitData);//[ 'menu', '0' ]形で出力
        console.log('選択したメニュー番号：'+ orderedMenu);//0の形で出力(数値)
          if (orderedMenu == 0) {
            console.log('タイ式（ストレッチ）を選択');
            orderTime0(ev,orderedMenu);
          }else if(orderedMenu == 1){
            console.log('タイ式（アロマ）を選択');
            orderTime1(ev,orderedMenu);
          }else if(orderedMenu == 2){
            console.log('足つぼマッサージを選択');
            orderTime2(ev,orderedMenu);
          }
      }else if(splitData[0] === 'menutime'){
        const orderedMenu = splitData[1];//メニュー取得
        const treatTime = splitData[2];//施術時間を取得
        console.log('menutimeのsplitData = ', splitData);//[ 'menutime', '0', '90' ]形で出力
        console.log('選択したメニユー番号：'+ orderedMenu);//0の形で出力(数値)
        console.log('選択した施術時間：'+ treatTime);//30の形で出力（数値）
        askDate(ev,orderedMenu,treatTime);
      }
 }
 //orderChoice関数（メニュー選択）
const orderChoice = (ev) => {
    return client.replyMessage(ev.replyToken,{
        "type":"flex",
        "altText":"menuSelect",
        "contents":
        {
            "type": "bubble",
            "header": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "メニューを選択してください",
                  "size": "lg",
                  "align": "center"
                }
              ]
            },
            "hero": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "（1つのみ選択可能です）",
                  "size": "md",
                  "align": "center"
                },
                {
                  "type": "separator",
                  "margin": "md"
                }
              ]
            },
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "タイ式（ストレッチ）",
                    "data": "menu&0"
                  },
                  "margin": "md",
                  "style": "primary",
                  "color": "#999999"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "タイ式（アロマオイル）",
                    "data": "menu&1"
                  },
                  "margin": "md",
                  "style": "primary",
                  "color": "#999999"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "足つぼ",
                    "data": "menu&2"
                  },
                  "margin": "md",
                  "style": "primary",
                  "color": "#999999"
                }
              ]
            },
            "footer": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "キャンセル",
                    "data": "hello"
                  }
                }
              ]
            }
          }
    });
}
//orderTime0関数（施術時間選択：タイ式ストレッチ）
const orderTime0 = (ev,orderedMenu) => {
    return client.replyMessage(ev.replyToken,{
      "type":"flex",
      "altText":"menuSelectTime",
      "contents":
      {
        "type": "bubble",
        "header": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "時間を選択してください",
              "align": "center"
            }
          ]
        },
        "hero": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "タイ式（ストレッチ）",
              "align": "center"
            },
            {
              "type": "separator",
              "margin": "md"
            }
          ]
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "30分　3,000円",
                "data": `menutime&${orderedMenu}&30`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "45分　4,000円",
                "data": `menutime&${orderedMenu}&45`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "60分　5,000円",
                "data": `menutime&${orderedMenu}&60`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "90分　7,000円",
                "data": `menutime&${orderedMenu}&90`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "120分　9,000円",
                "data": `menutime&${orderedMenu}&120`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "separator",
              "margin": "md"
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "キャンセル",
                "data": "hello"
              }
            }
          ]
        }
      }
    });
  }
  //orderTime1関数（施術時間選択：タイ式アロマ）
  const orderTime1 = (ev,orderedMenu) => {
    return client.replyMessage(ev.replyToken,{
      "type":"flex",
      "altText":"menuSelectTime",
      "contents":
      {
        "type": "bubble",
        "header": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "時間を選択してください",
              "align": "center"
            }
          ]
        },
        "hero": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "タイ式（アロマオイル）",
              "align": "center"
            },
            {
              "type": "separator",
              "margin": "md"
            }
          ]
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "45分　5,000円",
                "data": `menutime&${orderedMenu}&45`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "60分　7,000円",
                "data": `menutime&${orderedMenu}&60`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "90分　9,000円",
                "data": `menutime&${orderedMenu}&90`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "120分　12,000円",
                "data": `menutime&${orderedMenu}&120`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "separator",
              "margin": "md"
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "キャンセル",
                "data": "hello"
              }
            }
          ]
        }
      }
  
    });
  }
  //orderTime2関数（施術時間選択：足つぼ）
  const orderTime2 = (ev,orderedMenu) => {
    return client.replyMessage(ev.replyToken,{
      "type":"flex",
      "altText":"menuSelectTime",
      "contents":
      {
        "type": "bubble",
        "header": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "時間を選択してください",
              "align": "center"
            }
          ]
        },
        "hero": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "足つぼマッサージ",
              "align": "center"
            },
            {
              "type": "separator",
              "margin": "md"
            }
          ]
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "30分　3,000円",
                "data": `menutime&${orderedMenu}&30`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "60分　5,000円",
                "data": `menutime&${orderedMenu}&60`
              },
              "style": "primary",
              "color": "#999999",
              "margin": "md"
            },
            {
              "type": "separator",
              "margin": "md"
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "キャンセル",
                "data": "hello"
              }
            }
          ]
        }
      }
  
    });
  }
//askDate関数（来店希望日選択）
const askDate = (ev,orderedMenu,treatTime) => {
    return client.replyMessage(ev.replyToken,{
      "type":"flex",
      "altText":"予約日選択",
      "contents":
      {
        "type": "bubble",
        "header": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "来店希望日を選んでください",
              "margin": "md",
              "align": "center"
            }
          ]
        },
        "hero": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "separator",
              "margin": "md"
            }
          ]
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "datetimepicker",
                "label": "希望日を選択する",
                "data": `date&${orderedMenu}&${treatTime}`,
                "mode": "date"
              },
              "style": "primary"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "キャンセル",
                "data": "hello"
              },
              "margin": "md",
              "style": "secondary"
            }
          ]
        }
      }
    });
  }

