const Data = require('../models/Data'); 

module.exports = { 
    getData: (req,res) => { 
        Data.findData() 
        .then(data=>{ 
            console.log('data in controller:',data); 
            res.status(200).json(data); 
        }) 
        .catch(e=>console.log(e)); 
    } 
}