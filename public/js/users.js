(()=>{ 
    const API_URL = 'https://linebot-reservation.herokuapp.com/api/'; //★APIサーバアドレス
    window.addEventListener('load',()=>{ 
        fetchData(); 
    }); 
    const fetchData = async () => { 
        try{ const response = await fetch(API_URL); 
            console.log('response:',response); 
            const data = await response.json(); 
            console.log('data:',data);
        }catch(error){ 
            alert('データ読み込み失敗です'); } 
        } 


        
    })();