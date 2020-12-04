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
    port:5432//★ポート番号
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
//初期値設定
const WEEK = [ "日", "月", "火", "水", "木", "金", "土" ];
const MENU = ['タイ式（ストレッチ）','タイ式（アロマオイル）','足つぼ'];//★メニュー
const REGULAR_COLOSE = [1]; //★定休日の曜日

//顧客データベース作成
const create_userTable = {
    text:'CREATE TABLE IF NOT EXISTS users (id SERIAL NOT NULL, line_uid VARCHAR(255), display_name VARCHAR(255), timestamp VARCHAR(255));'
 };
 connection.query(create_userTable)
   .then(()=>{
       console.log('table users created successfully!!');
   })
   .catch(e=>console.log(e));
//予約データベースの作成
const create_reservationTable = {
  text:'CREATE TABLE IF NOT EXISTS reservations (id SERIAL NOT NULL, line_uid VARCHAR(255), name VARCHAR(100), scheduledate DATE, starttime BIGINT, endtime BIGINT, menu VARCHAR(50),treattime BIGINT);'
};
connection.query(create_reservationTable)
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
      const nextReservation = await checkNextReservation(ev);
      if(nextReservation.length){
        console.log('すでに予約あり');
        const startTimestamp = nextReservation[0].starttime;
        const date = dateConversion(startTimestamp);
        const orderedMenu = nextReservation[0].menu;
        const menu = MENU[orderedMenu];
        console.log('startTimestamp = ' + startTimestamp);//予約済みの日付タイムスタンプ
        console.log('date = ' + date);//タイムスタンプを文字列の形で出力
        console.log('orderedMenu = ' + orderedMenu);//メニューのindex数
        console.log('menu = ' + menu);//メニュー名
        return client.replyMessage(ev.replyToken,{
          "type":"flex",
          "altText": "cancel message",
          "contents":
          {
            "type": "bubble",
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": `次回予約は${date}\n${menu}でお取りしてます。変更の場合は予約キャンセル後改めて予約をお願いします。`,
                  "margin": "md",
                  "wrap": true
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
                    "label": "終了",
                    "data": "no"
                  },
                  "style": "secondary",
                }
              ]
            }
          }
        });
      }else{
        orderChoice(ev);
      }
    //orderChoice(ev);
    }else if(text === '予約確認'){
      const nextReservation = await checkNextReservation(ev);
      if(typeof nextReservation === 'undefined'){
        return client.replyMessage(ev.replyToken,{
          "type":"text",
          "text":"次回の予約は入っておりません。"
        })
      }else if(nextReservation.length){
        const startTimestamp = nextReservation[0].starttime;
        const date = dateConversion(startTimestamp);
        const menu = MENU[parseInt(nextReservation[0].menu)];
        const treatTime = nextReservation[0].treattime;
        console.log('startTimestamp = ' + startTimestamp);// スタート時間タイムスタンプの形で出力
        console.log('date = ' + date);//11月19日(木) 23:00の形で出力
        console.log('menu = ' + menu);//タイ式（ストレッチ）の形で出力
        console.log('treatTime = '+treatTime);//60の形で出力
        return client.replyMessage(ev.replyToken,{
          "type":"text",
          "wrap": true,
          "text":`次回予約は\n■■■■■■■■■\n\n${date}~\n${menu}${treatTime}分\n\n■■■■■■■■■\nでお取りしてます\uDBC0\uDC22`
        });
      }else{
        return client.replyMessage(ev.replyToken,{
          "type":"text",
          "text":"次回の予約は入っておりません。"
        })
      }
    }else if(text === '予約キャンセル'){
      const nextReservation = await checkNextReservation(ev);
      if(typeof nextReservation === 'undefined'){
        console.log('次回予約なし');
        return client.replyMessage(ev.replyToken,{
          "type":"text",
          "text":"次回の予約は入っておりません。"
        })
      }else if(nextReservation.length){
        const startTimestamp = parseInt(nextReservation[0].starttime);
        const orderedMenu = nextReservation[0].menu;
        const menu = MENU[parseInt(nextReservation[0].menu)];
        const treatTime = nextReservation[0].treattime;
        const date = dateConversion(startTimestamp);
        const id = parseInt(nextReservation[0].id);
        console.log('startTimestamp = '+startTimestamp);// スタート時間タイムスタンプの形で出力
        console.log('orderedMenu = '+orderedMenu);// オーターされたメニュー番号で出力
        console.log('menu = ' + menu);//タイ式（ストレッチ）の形で出力
        console.log('treatTime = '+treatTime);//60の形で出力
        console.log('date = ' + date);//11月19日(木) 23:00の形で出力
        console.log('id = ' + id);//5の形で出力
        console.log('次回予約があります');
        return client.replyMessage(ev.replyToken,{
          "type":"flex",
          "altText": "cancel message",
          "contents":
          {
            "type": "bubble",
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": `次回の予約は${date}~${menu}${treatTime}分でお取りしてます。この予約をキャンセルしますか？`,
                  "margin": "md",
                  "wrap": true
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
                    "label": "予約をキャンセル",
                    "data": `delete&${id}`
                  },
                  "style": "primary"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "終了",
                    "data": "no"
                  },
                  "style": "secondary",
                  "margin": "md"
                }
              ]
            }
          }
        });
      }else{
        return client.replyMessage(ev.replyToken,{
          "type":"text",
          "text":"次回の予約は入っておりません。"
        })
      }
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
      }else if(splitData[0] === 'date'){
        const orderedMenu = splitData[1];//メニュー取得
        const treatTime = splitData[2];//施術時間を取得
        const selectedDate = ev.postback.params.date;//来店日取得
        console.log('dateのsplitData = ', splitData);//[ 'date', '0', '90' ]形で出力
        console.log('選択したメニユー番号：'+ orderedMenu);//0の形で出力(数値)
        console.log('選択した施術時間：'+ treatTime);//30の形で出力（数値）
        console.log('選択した日付：'+ selectedDate);//2020-11-17の形で出力

        //「過去の日にち」、「定休日」、「２ヶ月先」の予約はできないようフィルタリングする
        const today_y = new Date().getFullYear();
        const today_m = new Date().getMonth() + 1;
        const today_d = new Date().getDate();
        const today = new Date(`${today_y}/${today_m}/${today_d} 0:00`).getTime() - 9*60*60*1000;
        const targetDate = new Date(`${selectedDate} 0:00`).getTime() - 9*60*60*1000;
        console.log('today_y = ' + today_y);//2020の形現在の年
        console.log('today_m = ' + today_m);//12の形現在の月
        console.log('today_d = ' + today_d);//4の形現在の日付
        console.log('today = ' + today);//現在の日付タイムスタンプ
        console.log('targetDate = ' + targetDate);//予約日付のタイムスタンプ
        //選択日が過去でないことの判定
        if(targetDate>=today){
          const targetDay = new Date(`${selectedDate}`).getDay();
          const dayCheck = REGULAR_COLOSE.some(day => day === targetDay);
          console.log('targetDay = ' + targetDay);
          console.log('dayCheck = ' + dayCheck);
        }



        askTime(ev,orderedMenu,treatTime,selectedDate);
      }else if(splitData[0] === 'time'){
        const orderedMenu = splitData[1];//メニュー取得
        const treatTime = splitData[2];//施術時間を取得
        const selectedDate = splitData[3];//来店日取得
        const selectedTime = splitData[4];//来店時間取得
        console.log('timeのsplitData = ', splitData);//[ 'time', '0', '30', '2020-11-17', '0' ]の形で出力
        console.log('選択したメニユー番号：'+ orderedMenu);//0の形で出力(数値)
        console.log('選択した施術時間：'+ treatTime);//30の形で出力（数値）
        console.log('選択した日付'+ selectedDate);//2020-11-17の形で出力
        console.log('来店時間：'+ selectedTime);//0の形で出力(数値)
        confirmation(ev,orderedMenu,treatTime,selectedDate,selectedTime);
      }else if(splitData[0] === 'delete'){
        const id = parseInt(splitData[1]);
        console.log('id:' + id);//5の形で出力
        const deleteQuery = {
          text:'DELETE FROM reservations WHERE id = $1;',
          values:[`${id}`]
        };
        connection.query(deleteQuery)
        .then(res=>{
          console.log('予約キャンセル成功');
          client.replyMessage(ev.replyToken,{
            "type":"text",
            "text":"予約をキャンセルしました。"
          });
        })
        .catch(e=>console.log(e));
      }else if(splitData[0] === 'yes'){
        const orderedMenu = splitData[1];//メニュー取得
        const treatTime = splitData[2];//施術時間を取得
        const selectedDate = splitData[3];//来店日取得
        const selectedTime = splitData[4];//来店時間取得
        const startTimestamp = timeConversion(selectedDate,selectedTime);//スタート日時をタイムスタンプ形式形式で取得
        //const treatTime = calcTreatTime(ev.source.userId,orderedMenu);//施術時間を取得
        const endTimestamp = startTimestamp + treatTime*60*1000;//施術終了時間を取得
        const insertQuery = {
          text:'INSERT INTO reservations (line_uid, name, scheduledate, starttime, endtime, menu, treattime) VALUES($1,$2,$3,$4,$5,$6,$7);',
          values:[ev.source.userId,profile.displayName,selectedDate,startTimestamp,endTimestamp,orderedMenu,treatTime]
        };
        connection.query(insertQuery)
          .then(res=>{
            console.log('予約データ格納成功！');
            client.replyMessage(ev.replyToken,{
              "type":"text",
              "wrap": true,
              "text":"予約が完了しました。\nご来店お待ちしております\uDBC0\uDC05"
            });
          })
          .catch(e=>console.log(e));
        console.log('startTime:',startTimestamp);
        console.log('endTime:',endTimestamp);
      }else if(splitData[0] === 'no'){
        return client.replyMessage(ev.replyToken,{
          "type":"text",
          "text":`終了します。`
      });
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
//askTime関数(時間帯を選択)
const askTime = (ev,orderedMenu,treatTime,selectedDate) => {
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
              "text": "ご希望の時間帯を選択してください\n（緑 ＝ 予約可能です）",
              "margin": "md",
              "align": "center",
              "wrap": true
            }
          ]
        },
        "hero": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": `${selectedDate}`,
              "margin": "none",
              "weight": "bold",
              "align": "center",
              "size": "lg"
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
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "12時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&0`
                  },
                  "style": "primary",
                  "margin": "md"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "13時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&1`
                  },
                  "style": "primary",
                  "margin": "md"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "14時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&2`
                  },
                  "style": "primary",
                  "margin": "md"
                }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "15時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&3`
                  },
                  "margin": "md",
                  "style": "primary"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "16時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&4`
                  },
                  "margin": "md",
                  "style": "primary"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "17時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&5`
                  },
                  "margin": "md",
                  "style": "primary"
                }
              ],
              "margin": "md"
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "18時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&6`
                  },
                  "margin": "md",
                  "style": "primary"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "19時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&7`
                  },
                  "margin": "md",
                  "style": "primary"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "20時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&8`
                  },
                  "margin": "md",
                  "style": "primary"
                }
              ],
              "margin": "md"
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "21時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&9`
                  },
                  "margin": "md",
                  "style": "primary"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "22時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&10`
                  },
                  "margin": "md",
                  "style": "primary"
                },
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "23時~",
                    "data": `time&${orderedMenu}&${treatTime}&${selectedDate}&11`
                  },
                  "margin": "md",
                  "style": "primary"
                }
              ],
              "margin": "md"
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "button",
                  "action": {
                    "type": "postback",
                    "label": "終了",
                    "data": "hello"
                  },
                  "margin": "md",
                  "style": "secondary"
                }
              ],
              "margin": "md"
            },
            {
              "type": "separator",
              "margin": "md"
            }
          ]
        },
      }
    });
}
//confirmation関数（確認メッセージをリプライ）
const confirmation = (ev,menu,menutime,date,time) => {
    const splitDate = date.split('-');
    const selectedTime = 12 + parseInt(time);
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
            "text": `次回ご予約は${splitDate[1]}月${splitDate[2]}日 ${selectedTime}時〜でよろしいですか？`,
            "margin": "md",
            "wrap": true
          }
        ]
      },
      "body": {
        "type": "box",
        "layout": "horizontal",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "はい",
              "data": `yes&${menu}&${menutime}&${date}&${time}`
            }
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "いいえ",
              "data": `no&${menu}&${menutime}&${date}&${time}`
            }
          }
        ]
      }
    }
    });
}
//checkNextReservation関数(未来に予約があるか確認)
const checkNextReservation = (ev) => {
  return new Promise((resolve,reject)=>{
    const id = ev.source.userId;
    const nowTime = new Date().getTime();
    
    const selectQuery = {
      text: 'SELECT * FROM reservations WHERE line_uid = $1 ORDER BY starttime ASC;',
      values: [`${id}`]
    };
    
    connection.query(selectQuery)
      .then(res=>{
        if(res.rows.length){
          const nextReservation = res.rows.filter(object=>{
            return parseInt(object.starttime) >= nowTime;
          });
          console.log('nextReservation:',nextReservation);
          resolve(nextReservation);
        }else{
          resolve();
        }
      })
      .catch(e=>console.log(e));
  });
 }
//timeConversion関数（選択日と選択時間使ってタイムスタンプ形式へ変換）
const timeConversion = (date,time) => {
    const selectedTime = 12 + parseInt(time) - 9;
    return new Date(`${date} ${selectedTime}:00`).getTime();
}
//dateConversion関数（タイムスタンプを任意の日付、時刻の文字列へ変換）
const dateConversion = (timestamp) => {
  const d = new Date(parseInt(timestamp));
  const month = d.getMonth()+1;
  const date = d.getDate();
  const day = d.getDay();
  const hour = ('0' + (d.getHours()+9)).slice(-2);
  const min = ('0' + d.getMinutes()).slice(-2);
  return `${month}月${date}日(${WEEK[day]}) ${hour}:${min}`;
 }
