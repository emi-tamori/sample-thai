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
                                console.log('data in model:', data);
                                resolve(data);
                            }
                        })
                        .catch(e=>console.log(e));
                    })
                })
                .catch(e=>console.log(e));
            })
            .catch(e=>console.log(e))
        })
    },
}
