"use strict";

const { User } = require("../models/user");
const { Driver } = require("../models/driver");
const { Order } = require("../models/order");
const { LocationLog } = require("../models/locationLog");

// const { Chat } = require("../models/chat");
const _ = require("lodash");

const mongoose = require("mongoose");
const ObjectId = require("mongoose").Types.ObjectId;
// const { sendFCM } = require("../services/fcmNotifications");

mongoose.set("debug", true);
function isObjectIdValid(id) {
  return new ObjectId(id) == id;
}
exports.connectSocket = (server) => {
  if (!server.app) server.app = {};
  server.app.socketConnections = {};

  // console.log("Server Listner: ", server);
  let io = require("socket.io")(server);

  io.on("connection", async (socket) => {
    try {
      // console.log("useriiiiid", socket.handshake.query.userId);
      // console.log("useriiiiid", socket.handshake.query.isSenderUser);

      if (socket.handshake.query.userId && socket.id && isObjectIdValid(socket.handshake.query.userId)) {
        console.log(`New connection request by UserID: ${socket.handshake.query.userId} on socketId: ${socket.id}`);

        let dataToSet = { socketId: socket.id, isOnline: true, lastSeen: new Date() };
        let userId = socket.handshake.query.userId;

        // console.log("Complete DATA: ", server.app.socketConnections);
        if (server.app.socketConnections.hasOwnProperty(userId)) {
          for (let key in server.app.socketConnections) {
            if (server.app.socketConnections[key] && server.app.socketConnections[key].userId && server.app.socketConnections[key].userId === userId)
              delete server.app.socketConnections[key];
          }
        }
        // server.app.socketConnections[userId].socketId = socket.id;
        // server.app.socketConnections[socket.id] = { userId: userId };
        server.app.socketConnections[userId] = { socketId: socket.id };
        server.app.socketConnections[socket.id] = { userId: userId };
        console.log("server.app.socketConnections", server.app.socketConnections);
        // Update user status
        // User.updateOne({ _id: userId }, dataToSet);
        if (socket.handshake.query.isSenderUser === "true") {
          await User.updateOne(
            { _id: userId },
            {
              $set: {
                socketId: dataToSet.socketId,
                isOnline: dataToSet.isOnline,
                lastSeen: dataToSet.lastSeen,
              },
            }
          );
          socket.broadcast.emit("isOnline", { isOnline: true, userId: userId });
        } else {
          await Driver.updateOne(
            { _id: userId },
            {
              $set: {
                socketId: dataToSet.socketId,
                isOnline: dataToSet.isOnline,
                lastSeen: dataToSet.lastSeen,
              },
            }
          );
          socket.broadcast.emit("isOnline", { isOnline: true, userId: userId });
        }
        socket.on("driverLocation", async (locationData) => {
          let dId = "";
          if (locationData.locationData) {
            dId = locationData.locationData.driverId;
          }

          if (dId && dId != "" && isObjectIdValid(dId)) {
            let driver = await Driver.findOne({ _id: locationData.locationData.driverId });
            if (driver) {
              // driver.location.coordinates[0] = locationData.locationData.location[0]
              // driver.location.coordinates[1] = locationData.locationData.location[1]
              // driver.name = "manjit"
              // await driver.save()
              await LocationLog.insertMany([
                {
                  name: driver.firstName,
                  mobile: driver.mobile,
                  userId: driver._id.toString(),
                  locationData: locationData.locationData,
                  role: "driver",
                },
              ]);
              await Driver.updateOne(
                { _id: locationData.locationData.driverId },
                {
                  $set: {
                    location: {
                      type: "Point",
                      coordinates: [locationData.locationData.location[0], locationData.locationData.location[1]],
                    },
                  },
                }
              );
              // let newDriver = await Driver.findOne({ _id: locationData.locationData.driverId })

              let criteria = {};
              criteria.driverId = driver._id.toString();
              criteria.orderStatus = { $nin: ["RETURNED", "DELIVERED", "CANCELLED"] };
              let orders = await Order.aggregate([{ $match: criteria }]);
              //   for (order of orders)
              if (orders.length > 0) {
                let userId = orders[0].userId;

                if (server.app.socketConnections && server.app.socketConnections.hasOwnProperty(userId)) {
                  // {
                  io.to(server.app.socketConnections[userId].socketId).emit("driverLocation", locationData);
                  // console.log(`sending location data to user ${userId}`, locationData);
                  // }
                }
              }
            } else {
              socket.emit("socketErr", {
                statusCode: 400,
                message: "No driver found",
                data: {},
              });
            }
          } else {
            socket.emit("socketErr", {
              statusCode: 400,
              message: "Invalid driver Id",
              data: {},
            });
          }
        });

        socket.on("disconnect", async () => {
          if (server.app.socketConnections.hasOwnProperty(socket.id)) {
            // console.log(`Disconnect Socket for User: ${server.app.socketConnections[socket.id].userId} and socketId: ${socket.id}`);
            var userId = server.app.socketConnections[socket.id].userId;
            if (userId && userId != "" && isObjectIdValid(userId)) {
              socket.broadcast.emit("isOnline", { isOnline: false, lastSeen: new Date(), userId: userId });
              let user = await User.findOne({ _id: userId });
              if (user) {
                user.socketId = "";
                user.isOnline = false;
                user.lastSeen = new Date();
                await user.save();
              } else {
                let driver = await Driver.findOne({ _id: userId });
                if (driver) {
                  driver.socketId = "";
                  driver.isOnline = false;
                  driver.lastSeen = new Date();
                  await driver.save();
                }
              }
            } else {
              socket.emit("socketErr", {
                statusCode: 400,
                message: "Invalid driver Id",
                data: {},
              });
            }
          }
          delete server.app.socketConnections[userId];
          delete server.app.socketConnections[socket.id];
        });
      } else {
        socket.emit("socketErr", {
          statusCode: 400,
          message: "No userId found",
          data: {},
        });
      }
    } catch (Ex) {
      console.log("Ex: ", Ex);
    }
  });
  exports.isOnline = (data) => {
    io.emit("isOnline", { isOnline: true, userId: data._id });
  };
};
