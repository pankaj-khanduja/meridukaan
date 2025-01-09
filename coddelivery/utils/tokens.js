const jwt = require("jsonwebtoken");
const config = require("config");

module.exports={
    generateVerifyToken: function () {
        return new Promise((done, reject)=>{
            require("crypto").randomBytes(20, (err, buf)=>{
                let token = buf.toString("hex");
                done(token);
                

                
            });
        });
    },
    generateOtp: function(){
        return new Promise((done, reject)=>{
            require("crypto").randomBytes(4,(err, buf)=>{
                let token = buf.toString("hex");
                done(token);
            });
        });
    }
};