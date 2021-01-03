const { Client } = require('pg');
const nodemailer = require('nodemailer');

const connection = new Client({
    user:process.env.PG_USER,
    host:process.env.PG_HOST,
    database:process.env.PG_DATABASE,
    password:process.env.PG_PASSWORD,
    port:5432
  });
connection.connect();

// const STAFFS = ['ken','emi','taro'];
const NUMBER_OF_SHIFTS = 3; //★何日先のシフトまで入れることができるか
const OPENTIME = 12; //★開店時間
const CLOSETIME = 23; //★閉店時間

//予約の重複チェックを行う関数
const doubleBookingCheck = (startTime,endTime,staffName,id) => {
    return new Promise((resolve,reject) => {
        let answer = null;
        const select_query = {
            text:`SELECT * FROM reservations.${staffName} WHERE endtime>=${startTime};`
        }
        connection.query(select_query)
            .then(res=>{
                if(res.rows.length){
                    const filteredArray = res.rows.filter(object=>{
                        return ((object.id != id)&&((object.starttime>=startTime && object.starttime<endTime) || (object.endtime>startTime && object.endtime<=endTime) || (object.starttime>=startTime && object.endtime<=endTime) || (object.starttime<=startTime && object.endtime>=endTime)));
                    });
                    answer = filteredArray.length ? false : true;
                }else{
                    answer = true;
                }
                resolve(answer);
            })
            .catch(e=>console.log(e));
    });
}

//gmailを送る関数
const gmailSend = (staffName,date,menu) => {
    return new Promise((resolve,reject)=> {
      const select_query = {
        text: `SELECT email FROM shifts WHERE name='${staffName}';`
      };
      connection.query(select_query)
        .then(address=>{
          //Gmail送信設定
          const message = {
            from: 'monsan.emi83@gmail.com',//★送信元アドレス
            to: 'monsan.emi83@gmail.com',//★送信先アドレス
            subject: `予約が入りました！！（การจองห้องพัก）`,
            text: `${date}に${menu}で予約が入りました！`
          };
  
          const auth = {
            type: 'OAuth2',
            user: 'monsan.emi83@gmail.com',//★gmail登録アドレス
            clientId: process.env.GMAIL_CLIENT_ID,
            clientSecret: process.env.GMAIL_CLIENT_SECRET,
            refreshToken: process.env.GMAIL_REFRESH_TOKEN
          };
  
          const transport = {
            service: 'gmail',
            auth: auth
          };
  
          const transporter = nodemailer.createTransport(transport);
          transporter.sendMail(message,(err,response)=>{
            console.log(err || response);
            resolve('gmail送信成功');
          });
        })
        .catch(e=>console.log(e));
    })
}

module.exports = {
    
    findData: () => {
        return new Promise((resolve,reject)=>{
            const pickup_users = {
                text:'SELECT * FROM users;'
            };

            connection.query(pickup_users)
                .then(users=>{
                    const pickup_staffs = {
                        text: 'SELECT * FROM shifts;'
                    }
                    connection.query(pickup_staffs)
                        .then(staffs=>{
                            const reservations = [];
                            staffs.rows.forEach((staff,index)=>{
                                const pickup_reservations = {
                                    text: `SELECT * FROM reservations.${staff.name};`
                                }
                                connection.query(pickup_reservations)
                                    .then(res=>{
                                        reservations.push(res.rows);
                                        if(index === staffs.rows.length-1) {
                                            const data = {
                                                users: users.rows,
                                                staffs: staffs.rows,
                                                reservations
                                            }
                                            resolve(data);
                                        }
                                    })
                                    .catch(e=>console.log(e));
                            })
                        })
                        .catch(e=>console.log(e));
                })
                .catch(e=>console.log(e))
        });
    },

    updateUser: ({id,name}) => {
        return new Promise((resolve,reject)=>{

            const update_query = {
                text:`UPDATE users SET (display_name) = ('${name}') WHERE id=${id};`
            }

            connection.query(update_query)
                .then(res=>{
                    console.log('お客さま情報更新成功');
                    resolve('お客さま情報更新成功');
                })
                .catch(e=>console.log(e.stack));
        });
    },

    getStaffs: () => {
        return new Promise((resolve,reject)=>{
            const pickup_staffs = {
                text:'SELECT * from shifts;'
            };
            connection.query(pickup_staffs)
                .then(res=>{
                    const arrangedData = [];
                    res.rows.forEach(obj=>{
                        //オブジェクトのディープコピー
                        const copiedObj = JSON.parse(JSON.stringify(obj))
                        const nowTime = new Date().getTime(); //現在時刻タイムスタンプ
                        const today_ts = new Date(new Date(nowTime).toDateString()).getTime() -9*60*60*1000; //0:00のタイムスタンプ

                        //現在のタイムスタンプとシフトが更新されたタイムスタンプの差を求める
                        const differential = today_ts - parseInt(copiedObj.updatedat);
                        //differntialの日数換算をする
                        const DaysByDifferential = Math.floor(differential/(24*60*60*1000));

                        // 現在と更新日が一致するとき
                        if(DaysByDifferential===0){
                            arrangedData.push(copiedObj);
                        }
                        // 現在と更新日の差がNUMBER_OF_SHIFTS以内かつ0より大きいとき
                        else if(DaysByDifferential<NUMBER_OF_SHIFTS && DaysByDifferential>0){
                            for(let i=0; i<NUMBER_OF_SHIFTS-DaysByDifferential; i++){
                                for(let j=OPENTIME;j<CLOSETIME;j++){
                                    copiedObj[`d${i}h${j}`] = copiedObj[`d${DaysByDifferential+i}h${j}`];
                                }
                            }
                            for(let i=NUMBER_OF_SHIFTS-DaysByDifferential;i<NUMBER_OF_SHIFTS;i++){
                                for(let j=OPENTIME;j<CLOSETIME;j++){
                                    copiedObj[`d${i}h${j}`] = null;
                                }
                            }
                            arrangedData.push(copiedObj);
                        }else{
                            for(let i=0;i<NUMBER_OF_SHIFTS;i++){
                                for(let j=OPENTIME;j<CLOSETIME;j++){
                                    copiedObj[`d${i}h${j}`] = null;
                                }
                            }
                            arrangedData.push(copiedObj);
                        }
                    });
                    resolve(arrangedData);
                })
                .catch(e=>console.log(e));
        })
    },

    staffRegister: ({name}) =>{
        return new Promise((resolve,reject) => {
            console.log('name in staffregister',name);
            const insert_query = {
                text: `INSERT INTO shifts (name) VALUES('${name}');`
            };
            connection.query(insert_query)
                .then(()=>{
                    const create_query = {
                        //text:`CREATE TABLE IF NOT EXISTS reservations.${name} (id SERIAL NOT NULL, line_uid VARCHAR(50), name VARCHAR(30), scheduledate DATE, starttime BIGINT, endtime BIGINT, menu VARCHAR(20), staff VARCHAR(30));`
                        text:`CREATE TABLE IF NOT EXISTS reservations.${name} (id SERIAL NOT NULL, line_uid VARCHAR(255), name VARCHAR(100), scheduledate DATE, starttime BIGINT, endtime BIGINT, menu VARCHAR(50), treattime BIGINT, staff VARCHAR(30));`
                    };
                    connection.query(create_query)
                        .then(()=>{
                            console.log('スタッフ登録完了');
                            resolve('スタッフ登録完了');
                        })
                        .catch(e=>console.log(e));
                })
                .catch(e=>console.log(e));
        });
    },

    staffDeleter: (name) => {
        return new Promise((resolve,reject)=>{
            const delete_shifts = {
                text: `DELETE FROM shifts WHERE name='${name}';`
            };
            connection.query(delete_shifts)
                .then(()=>{
                    const delete_reservations = {
                        text: `DROP TABLE reservations.${name};`
                    }
                    connection.query(delete_reservations)
                        .then(()=>{
                            console.log('スタッフ削除完了');
                            resolve('スタッフを削除しました');
                        })
                        .catch(e=>console.log(e));
                })
                .catch(e=>console.log(e));
        });
    },

    shiftRegister: (data) => {
        return new Promise((resolve,reject)=>{
            //UPDATEクエリ文生成
            data.forEach((obj,index)=>{
                let update_query = 'UPDATE shifts SET (updatedat,';
                let update_query2 = `(${obj.updatedat},`;
                for(let i=0;i<NUMBER_OF_SHIFTS;i++){
                    for(let j=OPENTIME;j<CLOSETIME;j++){
                        if(i=== NUMBER_OF_SHIFTS-1 && j===CLOSETIME-1){
                            update_query += `d${i}h${j}`+') = ';
                            update_query2 += obj[`d${i}h${j}`]+') ';
                        }else{
                            update_query += `d${i}h${j}`+',';
                            update_query2 += obj[`d${i}h${j}`]+',';
                        }
                    }
                }
                update_query += update_query2 + `WHERE id=${obj.id};`;
                console.log('update_query:',update_query);

                //データアップデート
                connection.query(update_query)
                    .then(()=>{
                        console.log(`${obj.name}のシフトデータ更新成功!`);
                        if(index===data.length-1) resolve('データ更新成功');
                    })
                    .catch(e=>console.log(e));
            })
        })
    },

    updateReservationData: ({customerName,staffName,selectedYear,selectedMonth,selectedDay,sHour,sMin,eHour,eMin,menu,id}) => {
        return new Promise((resolve,reject) => {
            const startTime = new Date(`${selectedYear}/${selectedMonth}/${selectedDay} ${sHour}:$${sMin}`).getTime() -9*60*60*1000;
            const endTime = new Date(`${selectedYear}/${selectedMonth}/${selectedDay} ${eHour}:$${eMin}`).getTime() -9*60*60*1000;
            const scheduleDate = `${selectedYear}-${selectedMonth}-${selectedDay}`;

            //予約重複チェック
            doubleBookingCheck(startTime,endTime,staffName,id)
                .then(answer=>{
                    console.log('answer:',answer);
                    if(answer){
                        const update_query = {
                            text:`UPDATE reservations.${staffName} SET (name,scheduledate,starttime,endtime,menu,treattime,staff) = ('${customerName}','${scheduleDate}',${startTime},${endTime},'${menu}','${staffName}') WHERE id=${id};`
                        };
                        connection.query(update_query)
                            .then(()=>{
                                console.log('予約データ更新成功');
                                resolve('予約データ更新成功');
                            })
                            .catch(e=>console.log(e));
                    }else{
                        console.log('重複あり');
                        resolve('予約に重複があるため、予約データを更新できません');
                    }
                })
                .catch(e=>console.log(e));
        });
    },

    deleteReservationData: (staffName,id) => {
        return new Promise((resolve,reject)=>{
            const delete_query = {
                text:`DELETE FROM reservations.${staffName} WHERE id=${id};`
            }
            connection.query(delete_query)
                .then(()=>{
                    console.log('データ削除成功');
                    resolve('予約データ削除しました');
                })
                .catch(e=>console.log(e));
        });
    },

    createReservation: ({customerName,staffName,selectedYear,selectedMonth,selectedDay,sHour,sMin,eHour,eMin,menu,}) => {
        return new Promise((resolve,reject)=>{
            const startTime = new Date(`${selectedYear}/${selectedMonth}/${selectedDay} ${sHour}:$${sMin}`).getTime() -9*60*60*1000;
            const endTime = new Date(`${selectedYear}/${selectedMonth}/${selectedDay} ${eHour}:$${eMin}`).getTime() -9*60*60*1000;
            const scheduleDate = `${selectedYear}-${selectedMonth}-${selectedDay}`;

            //予約重複チェック
            doubleBookingCheck(startTime,endTime,staffName,-1)
                .then(answer=>{
                    if(answer){
                        const insert_query = {
                            text:`INSERT INTO reservations.${staffName} (name,scheduledate,starttime,endtime,menu,treattime,staff) VALUES ('${customerName}','${scheduleDate}',${startTime},${endTime},'${menu}','${treattime}','${staffName}');`
                        };
                        connection.query(insert_query)
                            .then(()=>{
                                console.log('予約データ作成成功');
                                gmailSend(staffName,scheduleDate,menu)
                                    .then(text=>{
                                        console.log(text);
                                        resolve('新規予約データ作成成功');
                                    })
                                    .catch(e=>console.log(e));
                            })
                            .catch(e=>console.log(e));
                    }else{
                        console.log('重複あり');
                        resolve('予約に重複があるため、新規予約登録できません');
                    }
                })
                .catch(e=>console.log(e));
        });
    }
}