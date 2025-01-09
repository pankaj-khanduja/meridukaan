const jwt = require("jsonwebtoken");
const config = require("config");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(config.get("sendGridApiKey"));


module.exports=
{   generateVerifyToken: 
    async function () {
        return new Promise((done, reject)=>{
            require("crypto").randomBytes(20, (err, buf)=>{
                let token = buf.toString("hex");
                done(token);
                // console.log(token);
                });
            })
    },
    sendEmailActivationLink:
    async function (user, type, verificationToken) {

    const message = {
        to: user.email,
        from: {
          name: "Manjit Singh",
          email: "xa4204@gmail.com",
        },
        subject: "Email verification",
        text: `Hi, You are receiving this because you (or someone else) have requested to use this email to register to the abc app.\n\n
          Please verify by clicking on the link below\n\n 
          http://localhost:4000/${type}/verifyByEmail?token=${verificationToken} 
          \n\n If you did not request this, please ignore this email .\n`,
      };
      sgMail
        .send(message)
        .then((response) => console.log("Email Sent..."))
        .catch((error) => console.log(error.message));
      // console.log("hb",verificationToken);
    }
}

