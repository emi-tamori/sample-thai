const { Client } = require('pg'); 

const connection = new Client({ 
    user:process.env.PG_USER, 
    host:process.env.PG_HOST, 
    database:process.env.PG_DATABASE, 
    password:process.env.PG_PASSWORD, 
    port:5432 
}); 
connection.connect(); 

module.exports = { 
    findData: () => { 
        return new Promise((resolve,reject)=>{ 
            const pickup_users = { 
                text:'SELECT * FROM users;' 
            }; 
            const pickup_reservations = { 
                text:'SELECT * FROM reservations;' 
            }; 
            connection.query(pickup_users) 
            .then(users=>{ 
                connection.query(pickup_reservations) 
                .then(reservations=>{ 
                    const data = { users:users, reservations:reservations } 
                    console.log('data in model:',data); 
                    resolve(data); 
                }) 
                .catch(e=>console.log(e)) 
            }) 
                .catch(e=>console.log(e)) 
            }); 
            } 
        }