const { MIDDLEWARE_AUTH_CONSTANTS } = require("../config/constant.js");
const jwt = require("jsonwebtoken");
const config = require("config");
const mongoose = require("mongoose");
const { Admin } = require("../models/admin");
const { User } = require("../models/user");
const { Driver } = require("../models/driver");
const { Vendor } = require("../models/vendor");
const { Influencer } = require("../models/influencer");
const { Role } = require("../models/role");

function identityManager(allowedRoleArray, allowedScopeObj) {
  return async (req, res, next) => {
    if (!config.get("requiresAuth")) return next();

    req.apiId = mongoose.Types.ObjectId();
    req.startTimeMilli = Math.round(new Date());
    const token = req.header("Authorization");

    if (!token && !allowedRoleArray.includes("public")) {
      return res.status(401).send({
        apiId: req.apiId,
        statusCode: 401,
        message: "Failure",
        data: { message: MIDDLEWARE_AUTH_CONSTANTS.ACCESS_DENIED },
      });
    }

    if (!token && allowedRoleArray.includes("public")) {
      req.jwtData = {};
      req.jwtData.role = "public";
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.get("jwtPrivateKey"));
      req.jwtData = decoded;
      console.log("HELLO", req.jwtData, " HQ",decoded, "HI ", decoded.role )
      if (!allowedRoleArray.includes(decoded.role)) {
        return res.status(403).send({
          apiId: req.apiId,
          statusCode: 403,
          message: "Failure",
          data: { message: MIDDLEWARE_AUTH_CONSTANTS.RESOURCE_FORBIDDEN },
        });
      }

      switch (decoded.role) {
        case "influencer":
          var influencer = await Influencer.findOne({ _id: decoded.userId });
          if (!influencer || (influencer && influencer.accessToken !== token))
            return res.status(401).send({
              apiId: req.apiId,
              statusCode: 401,
              message: "Failure",
              data: { message: MIDDLEWARE_AUTH_CONSTANTS.ACCESS_DENIED },
            });
          req.userData = influencer;
          req.reqUserId = decoded.userId;

          break;
        case "user":
          var user = await User.findOne({ _id: decoded.userId });

          if (!user || (user && user.accessToken !== token))
            return res.status(401).send({
              apiId: req.apiId,
              statusCode: 401,
              message: "Failure",
              data: { message: MIDDLEWARE_AUTH_CONSTANTS.ACCESS_DENIED },
            });
          req.userData = user;
          req.reqUserId = decoded.userId;
          break;

        case "driver":
          var driver = await Driver.findOne({ _id: decoded.userId });
          if (!driver || (driver && driver.accessToken !== token))
            return res.status(401).send({
              apiId: req.apiId,
              statusCode: 401,
              message: "Failure",
              data: { message: MIDDLEWARE_AUTH_CONSTANTS.ACCESS_DENIED },
            });
          req.userData = driver;
          req.reqUserId = decoded.userId;
          break;

        // case "public":
        //   var user = await User.findOne({ _id: decoded.userId });
        //   if(!user && user.accessToken !== token){

        //   }
        //   break;
        case "vendor":
          let vendor = await Vendor.findOne({ _id: decoded.userId });
          if (!vendor || (vendor && vendor.accessToken !== token))
            return res.status(401).send({
              apiId: req.apiId,
              statusCode: 401,
              message: "Failure",
              data: { message: MIDDLEWARE_AUTH_CONSTANTS.ACCESS_DENIED },
            });
          req.userData = vendor;
          req.reqUserId = decoded.userId;
          break;
        case "admin":
          let admin = await Admin.findOne({ _id: decoded.userId });
          if (!admin || (admin && admin.accessToken !== token))
            return res.status(401).send({
              apiId: req.apiId,
              statusCode: 401,
              message: "Failure",
              data: { message: MIDDLEWARE_AUTH_CONSTANTS.ACCESS_DENIED },
            });
          req.userData = admin;
          req.reqUserId = decoded.userId;
          let permissions = await Role.findOne({ role: req.userData.subRole });
          if (!permissions) {
            return res.status(403).send({ apiId: req.apiId, statusCode: 403, message: "Failure", data: MIDDLEWARE_AUTH_CONSTANTS.RESOURCE_FORBIDDEN });
          }
          let isAllowed = checkScope(allowedScopeObj, permissions.permissions);
          if (!isAllowed) {
            return res.status(403).send({ apiId: req.apiId, statusCode: 403, message: "Failure", data: MIDDLEWARE_AUTH_CONSTANTS.RESOURCE_FORBIDDEN });
          }
          break;
        default:
          return res.status(401).send({
            apiId: req.apiId,
            statusCode: 401,
            message: "Failure",
            data: { message: MIDDLEWARE_AUTH_CONSTANTS.ACCESS_DENIED },
          });
      }
      next();
    } catch (ex) {
      console.log(ex);
      res.status(401).send({
        apiId: req.apiId,
        statusCode: 401,
        message: "Failure",
        data: { message: MIDDLEWARE_AUTH_CONSTANTS.INVALID_AUTH_TOKEN },
      });
    }
  };
}

function checkScope(allowedScopeObj, userPermissionObj) {
  console.log(userPermissionObj);
  if (allowedScopeObj) {
    for (const [key, value] of Object.entries(allowedScopeObj)) {
      let userPermissionValue = userPermissionObj[key];
      console.log("Key: ", key, " userPermissionValue: ", userPermissionValue, " allowedScopeValue: ", value);
      if (!userPermissionValue) {
        return false;
      }
      if (value == "W" && userPermissionValue != "W") {
        return false;
      }
      if (value == "R" && userPermissionValue == "H") {
        return false;
      }
    }
  }
  return true;
}
module.exports.identityManager = identityManager;
