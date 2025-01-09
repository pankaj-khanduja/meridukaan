const { ROLE_CONSTANTS } = require("../config/constant.js");
const { Role, validateRolePost } = require("../models/role");
const express = require("express");
const { identityManager } = require("../middleware/auth");
const _ = require("lodash");
const mongoose = require("mongoose");

const router = express.Router();

router.get("/", identityManager(["admin"], { roles: "W" }), async (req, res) => {
  let criteria = {};
  if (req.query.text) {
    var regexName = new RegExp(req.query.text, "i");
    criteria.role = regexName;
  }
  var skipVal, limitVal;
  if (isNaN(parseInt(req.query.offset))) skipVal = 0;
  else skipVal = parseInt(req.query.offset);
  if (isNaN(parseInt(req.query.limit))) limitVal = 500;
  else limitVal = parseInt(req.query.limit);
  if (req.query.roleId) {
    criteria._id = mongoose.Types.ObjectId(req.query.roleId);
  }
  let roleList = await Role.aggregate([
    { $match: criteria },
    { $sort: { insertDate: -1 } },
    { $skip: skipVal },
    { $limit: limitVal },
    {
      $project: {
        roleId: "$_id",
        role: 1,
        permissions: 1,
        status: 1,
        notEditable: 1,
        _id: 0,
      },
    },
  ]);
  let totalCount = await Role.countDocuments(criteria);
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { totalCount, roleList },
  });
});

router.post("/", identityManager(["admin"], { roles: "W" }), async (req, res) => {
  const { error } = validateRolePost(req.body);
  if (error) return res.status(400).send({apiId: req.apiId,statusCode: 400,message: "Failure",data: { message: error.details[0].message }});

  let role = await Role.findOne({ role: req.body.role.toLowerCase() });
  if (!role) role = new Role({ role: req.body.role.toLowerCase() });
  
  if (role.notEditable === true) return res.status(400).send({apiId: req.apiId,statusCode: 400,message: "Failure",data: { message: ROLE_CONSTANTS.NOT_EDITABLE }});

  role.permissions = req.body.permissions;
  await role.save();

  roleId = role._id.toString();
  
  let response = _.pick(role, ["roleId", "role", "permissions"]);
  
  res.send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ROLE_CONSTANTS.SUCCESS, response },
  });
});

router.delete("/:id", identityManager(["admin"], { roles: "W" }), async (req, res) => {
  let role = await Role.findOne({ _id: req.params.id, notEditable: false });
  if (!role)
    return res.status(400).send({
      apiId: req.apiId,
      statusCode: 400,
      message: "Failure",
      data: { message: ROLE_CONSTANTS.NOT_FOUND },
    });
  await Role.deleteOne({ _id: req.params.id });
  res.status(200).send({
    apiId: req.apiId,
    statusCode: 200,
    message: "Success",
    data: { message: ROLE_CONSTANTS.DELETED },
  });
});

module.exports = router;
