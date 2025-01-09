// users.js
const ADMIN_CONSTANTS = {
  APPLICATION_UPDATED: "Application updated successfully.",
  DATA_UPDATED: "Data updated successfully.",
  ORDER_REFUNDED_SUCCESSFULLY: "Order refunded successfully.",
  REFUND_FAILED: "Order refund failed, Please try after some time.",
  EMAIL_ALREADY_EXISTS: "Email already registered",
  NOT_FOUND: "User not found.",
  DELETED: "User deleted successfully.",
  PASSWORD_SENT_TO_EMAIL: "New password has been sent to your registered email.",
};
const OTHER_CONSTANTS = {
  VEHICLE_ALREADY_EXISTS: "Vehicle type already exists.",
  VEHICLE_NOT_FOUND: "Vehicle type not found.",
  VEHICLE_CREATED: "Vehicle type created successfully.",
  VEHICLE_DELETED: "Vehicle type deleted successfully.",
  PICK_UP_CAT_ALREADY_EXISTS: "Pick up category already exists.",
  PICK_UP_CAT_CREATED: "Pick up category created successfully.",
  PICK_UP_CAT_DELETED: "Pick up category deleted successfully.",
  PICK_UP_CAT_NOT_FOUND: "Pick up category not found.",
  DELIVERY_NOT_POSSIBLE: "Delivery is not possible at this address.",
  DELIVERY_POSSIBLE: "Delivery is possible at this address.",
  DELIVERY_NOT_POSSIBLE_ON_THIS_TIME: "Delivery is not possible at this time, Kindly check back tomorrow.",
  NOT_SERVING: "We are not serving in your area currently.",
};
const USER_CONSTANTS = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  INVALID_PASSWORD: "Invalid password",
  USER_NOT_FOUND: "User not found",
  EMAIL_ALREADY_EXISTS: "Email already registered",
  MOBILE_ALREADY_EXISTS: "Phone no. is already registered",
  USERNAME_ALREADY_EXISTS: "Username already taken, please choose another username.",
  LOGGED_IN: "Logged in successfully",
  REGISTERED_SUCCESSFULLY: "You have registered successfully.",
  DELETED_USER: "User deleted successfully",
  PASSWORD_RESET_SUCCESS: "Password resetted successfully",
  VERIFICATION_SUCCESS: "Your details have been verified succesfully.",
  INVALID_USER: "User not found",
  INVALID_REFERRAL_CODE: "Referral code is Invalid/Expired.",
};
const DRIVER_CONSTANTS = {
  INVALID_EMAIL: "Invalid email",
  ADMIN_REQUESTED: "Your application request has been submitted to admin.",
  DOCUMENT_NOT_APPROVED: "Your documents are not approved yet.",
  APPLICATION_REJECTED: "Application rejected",
  INVALID_PASSWORD: "Invalid password",
  DRIVER_NOT_FOUND: "Driver not found",
  DRIVER_UPDATED: "Driver updated successfully.",
  VENDOR_ASSIGNED: "Vendor assigned successfully.",
  EMAIL_ALREADY_EXISTS: "Email already registered",
  MOBILE_ALREADY_EXISTS: "Phone no. is already registered",
  USERNAME_ALREADY_EXISTS: "Username already taken, please choose another username.",
  LOGGED_IN: "Logged in successfully",
  REGISTERED_SUCCESSFULLY: "You have registered successfully.",
  DELETED_USER: "Driver deleted successfully",
  PASSWORD_RESET_SUCCESS: "Password resetted successfully",
  VERIFICATION_SUCCESS: "Your details have been verified succesfully.",
  MAX_ORDER_LIMIT_REACHED: "You already have enough orders. Deliver them first",
  ORDER_ALREADY_ASSIGNED: "Order is already assigned to driver.",
  INVALID_DRIVER: "Driver not found",
  DRIVER_UNFREEZED_SUCCESS: "Driver unfreezed successfully.",
  NOT_NEARBY_USER: "Currently you are not nearby to the user.Please reach the user location to go further.",
  NOT_NEARBY_VENDOR: "Currently you are not nearby to the vendor.Please reach the vendor location to go further",
};
const ADDRESS_CONSTANTS = {
  ADDRESS_REQUIRED: "addressId is required",
  INVALID_ADDRESS: "Address not found",
  SET_DEFAULT: "Address set as default",
  ADDRESS_DELETED: "Address deleted successfully",
};
// middleware auth
const MIDDLEWARE_AUTH_CONSTANTS = {
  ACCESS_DENIED: "Access denied. No authorization token provided",
  RESOURCE_FORBIDDEN: "You don't have access to the request resource.",
  INVALID_AUTH_TOKEN: "Invalid token",
};

const VENDOR_CONSTANTS = {
  // INVALID_EMAIL: "Invalid email",
  // INVALID_PASSWORD: "Invalid password",
  VENDOR_NOT_FOUND: "Vendor not found",
  NOT_AVAILABLE: "Sorry, Vendor is currently unavailable.",
  ACCOUNT_INACTIVE: "Your account is currently inactive or delete by admin",
  EMAIL_ALREADY_EXISTS: "Email already registered",
  NAME_ALREADY_EXISTS: "Name already taken, please choose another username.",
  LOGGED_IN: "Logged in successfully",
  VENDOR_CREATED: "Vendor created successfully.",
  VENDOR_UPDATED: "Vendor updated successfully.",
  SLOT_CREATED: "Slot created successfully.",
  SLOT_UPDATED: "Slot updated successfully.",
  SLOT_NOT_FOUND: "Slot not found.",
  SLOT_DELETED: "Slot deleted successfully.",
  DELETED_VENDOR: "Vendor deleted successfully",
  APPROVED: "Application approved...",
  INVALID_FORMAT: "Data format is wrong",
  INVALID_LOGIN_CREDENTIALS: "Invalid email or password",
  NOT_REGISTERED: "You are not registered.",
  INVALID_TOKEN: "Your token is invalid",
  VERIFIED_SUCCESS: "Your data has been verified successfully",
  TOKEN_EXPIRED: "Your token has been expired.",
  PASSWORD_MISMATCH: "Passwords are not matching",
  REJECTED: "Application rejected...",
  INVALID_FORMAT: "Data format is wrong",
  INVALID_LOGIN_CREDENTIALS: "Invalid email or password",
  NOT_APPROVED: "You are not yet approved by the Admin",
  INVALID_TOKEN: "Your token is invalid",
  VERIFIED_SUCCESS: "Your data has been verified successfully",
  TOKEN_EXPIRED: "Your token has been expired.",
  PASSWORD_MISMATCH: "Passwords are not matching",
  INVALID_MOBILE: " Your mobile no. is invalid",
  INVALID_FORMAT: "Not a valid format",
  CURRENTLY_CLOSED: "We are currently closed.",
  PASSWORD_CHANGE_SUCCESS: "Password changed successfully.",
};

const INFLUENCER_CONSTANTS = {
  INVALID_EMAIL: "Invalid email",
  INVALID_PASSWORD: "Invalid password",
  INFLUENCER_NOT_FOUND: "Influencer not found",
  NOT_AVAILABLE: "Sorry, Influencer is currently unavailable.",
  ACCOUNT_INACTIVE: "Your account is currently inactive or deleted by admin",
  EMAIL_ALREADY_EXISTS: "Email already registered",
  NAME_ALREADY_EXISTS: "Name already taken, please choose another username.",
  LOGGED_IN: "Logged in successfully",
  INFLUENCER_CREATED: "Influencer created successfully.",
  INFLUENCER_UPDATED: "Influencer updated successfully.",

  DELETED_INFLUENCER: "Influencer deleted successfully",

  INVALID_FORMAT: "Data format is wrong",
  INVALID_LOGIN_CREDENTIALS: "Invalid email or password",
  NOT_REGISTERED: "You are not registered.",
  INVALID_TOKEN: "Your token is invalid",
  VERIFIED_SUCCESS: "Your data has been verified successfully",
  TOKEN_EXPIRED: "Your token has been expired.",
  PASSWORD_MISMATCH: "Passwords are not matching",
  REJECTED: "Application rejected...",
  INVALID_FORMAT: "Data format is wrong",
  INVALID_LOGIN_CREDENTIALS: "Invalid email or password",
  PASSWORD_CHANGE_SUCCESS: "Password changed successfully.",
};

const STORE_CONSTANTS = {
  NO_STORE_FOUND: "There is not any store with this store id",
  STORE_DELETED: "Yor store has been deleted successfully",
  INVALID_FORMAT: "Data format is invalid",
  INVALID_LOGIN_CREDENTIALS: "Invalid email or password",
};
const OTP_CONSTANTS = {
  INVALID_USER: "Your are not a valid user",
  NO_USER_REGISTERED_ERROR: "No user registered with given data",
  DUPLICATE_MOBILE_NUMBER: "Mobile number entered is already registered. Please try to login.",
  DUPLICATE_EMAIL: "Email entered is already registered. Please try to login.",
  INVALID_MOBILE_NUMBER: "Invalid mobile number entered. Please provide valid US mobile number.",
  INVALID_MOBILE_NUMBER: "Invalid email address entered. Please provide valid email.",
  SMS_SENDING_FAILED: "Sms sending failed due to some application issue",
  EMAIL_SENDING_FAILED: "Email sending failed due to some application issue",
  OTP_GENERATED_SUCCESSFULLY: "Verification code generated successfully",
  OTP_VERIFIED: "Verification code verified for new user",
  INVALID_OTP: "Invalid OTP passed",
  OTP_MAX_LIMIT_ERROR: "Max attempts to verify code breached",
  OTP_EXPIRED: "Verification code expired",
  OTP_VERIFIED_NEW_USER: "Verification code verified for new user",
  PASSWORD_MISMATCH: "Passwords are not matchong",
  OTP_MISSING_UPDATE: "Otp is required.",
  INVALID_MOBILE: "Invalid mobile number entered. Please provide valid nigerian mobile number.",
};

const AUTH_CONSTANTS = {
  INVALID_USER: "INVALID_USER",
  INVALID_CREDENTIALS: "Your credentials are incorrect, Try again",
  INVALID_PASSWORD: "You have entered incorrect password. Please try again with valid password.",
  CHANGE_PASSWORD_REQUEST_SUCCESS: "Password recovery link has been sent to your registered email.",
  CHANGE_PASSWORD_REQUEST_EMAIL_FAILURE: "Email sending failed due to some application issue.",
  INVALID_EMAIL: "The email provided is not registered. Please sign up to continue.",
  INVALID_RECOVERY_LINK: "Password link expired or not valid.",
  PASSWORD_CHANGE_SUCCESS: "Password changed successfully",
  INVALID_OTP: "Invalid OTP passed",
  INVALID_MOBILE: "No user found with given mobile.",
  MOBILE_REQUIRED: '"mobile" is required',
  OTP_TOKEN_REQUIRED: '"otpToken" is required',
  OLD_NEW_PASSWORD_NOTSAME: "Old password and new password must not be same",
  INACTIVE_ACCOUNT: "Your account is currently deactivated",
};

const PRODUCT_CONSTANTS = {
  NOT_FOUND: "PRODUCT NOT FOUND",
  DELETED: "PRODUCT DELETED",
  UPDATED: "PRODUCT UPDATED",
  INSERTED: "PRODUCT INSERTED",
  UNAVAILABLE: "Some of the products are removed from your cart, because they are either deleted or their price got changed. Kindly check and proceed again.",
  SUBCATEGORY_REQUIRED: "You need to update subcategory as well, if you are updating the category.",
};
const ROLE_CONSTANTS = {
  NOT_FOUND: "Role not found",
  DELETED: "ROLE DELETED",
  SUCCESS: "Success",
  NOT_EDITABLE: "This is role already exists and it is not editable.",
};
const TOPPING_CONSTANTS = {
  NOT_FOUND: "VARIANT NOT FOUND",
  DELETED: "VARIANT DELETED",
  UPDATED: "VARIANT UPDATED",
  INSERTED: "VARIANT INSERTED",
};
const SUBACCOUNT_CONSTANTS = {
  NOT_FOUND: "Subaccount not found.",
  SUBACCOUNT_SET_DEFAULT: "Subaccount set as default.",
  SUBACCOUNT_DELETED: "Subaccount deleted successfully.",
  SUBACCOUNT_ALREADY_EXISTS: "A subaccount with the account number and bank already exists",
  SUBACCOUNT_CREATED: "Subaccount created successfully.",
};

const CAT_CONSTANTS = {
  DESG_NOT_FOUND: "unit not found.",
  // DESG_DELETED: "You have deleted successfully.",
  DESG_UPDATE: "unit UPDATED SUCCESSFULLY.",
  CAT_CREATE: "Category created successfully",

  INVALID_FORMAT: "invalid format",
  CAT_NOT_FOUND: "Category not found",
  CAT_UPDATE: "Category updated successfully",
  CAT_DELETED: " Category deleted successfully",
};
const SUB_CAT_CONSTANTS = {
  DESG_NOT_FOUND: "unit not found.",
  // DESG_DELETED: "You have deleted successfully.",
  SUB_CAT_NOT_FOUND: "sub Category not found",

  DESG_UPDATE: "unit UPDATED SUCCESSFULLY.",
  INVALID_FORMAT: "invalid format",
  SUB_CAT_NOT_FOUND: "Sub Category not found",
  SUB_CAT_CREATE: "Sub Category created successfully",

  SUB_CAT_UPDATE: "Sub Category updated successfully",
  SUB_CAT_DELETED: " Sub Category deleted successfully",
};
const BANNER_CONSTANTS = {
  DESG_UPDATE: "unit UPDATED SUCCESSFULLY.",
  BANNER_ADD: "Banner add successfully",
  BANNER_ALREADY_EXISTS: "Banner already added.",

  INVALID_FORMAT: "invalid format",
  BANNER_NOT_FOUND: "Banner not found",
  BANNER_UPDATE: "Banner updated successfully",
  BANNER_DELETED: " Banner deleted successfully",
};
const CITY_CONSTANTS = {
  CITY_ADDED: "City added successfully",
  CITY_ALREADY_EXISTS: "City with the same name already exists.",

  INVALID_FORMAT: "invalid format",
  CITY_NOT_FOUND: "City not found",
  CITY_DELETED: "City deleted successfully",
};
const SERVICE_AREA_CONSTANTS = {
  SERVICE_AREA_ADDED: "Service area added successfully",
  SERVICE_AREA_ALREADY_EXISTS: "Service area with the same city already exists.",

  INVALID_FORMAT: "invalid format",
  SERVICE_AREA_NOT_FOUND: "Service area not found",
  SERVICE_AREA_DELETED: "Service area deleted successfully",
};

const UNIT_CONSTANTS = {
  DESG_NOT_FOUND: "Unit not found.",
  DESG_DELETED: "You have deleted successfully.",
  DESG_UPDATE: "UNIT UPDATED SUCCESSFULLY.",
};
const CART_CONSTANTS = {
  INVALID_ID: "Invalid Product Id",
  NO_PRODUCT: "Product not found",
  CART_NOT_FOUND: "Cart not found.",
  DEVICE_TOKEN: "DeviceToken is required.",
  DELETED: "Product Deleted",
  NOT_FOUND: "Cart not found",
  QTY_ZERO: "Quantity of this item is zero",
  OUT_OF_STOCK: "PRODUCT IS OUT OF STOCK NOW",
  ITEM_UNAVAILABLE: "Items are currently unavailable.",
  SOMEITEMS_UNAVAIL: "Some of the items are unavailable.",
  ITEMS_ADDED_CART: "Items are added to the cart",
  ITEM_ADDED: "Item is added",
  ITEM_REMOVED: "Item is removed",
  CART_CLEARED: "Cart cleared successfully",
  CART_DELETED: "Cart deleted successfully",
  CART_EXISTED: "Cart already existed.",
  CART_CREATED: "Cart created successfully.",
};
const OFFER_CONSTANTS = {
  INVALID_OFFER: "Invalid offer",
  OFFER_EXISTS: "Offer with the same already exists",
  OFFER_EXP: "Offer expired",
  OFFER_CREATED: "Offer created successfully",
  NOT_FOUND: "No offers found",
};
const CARD_CONSTANTS = {
  INVALID_USER: "INVALID_USER",
  INVALID_CARD: "Card with given Id not found",
  SET_DEFAULT: "Card set as default",
  CARD_REQUIRED: "cardId is mandatory parameter",
  CARD_ADDING_FAILED: "Card addition failed.",
  CARD_DELETE_SUCCESS: "Card removed successfully",
};
const RATING_CONSTANTS = {
  ALREADY_RATED_DRIVER: "You have already rated this driver for this order",
  ALREADY_RATED: "You have already rated for this order.",
  RATING_ADDED_SUCCESSFULLY: "Rating added successfully.",
};
const ORDER_CONSTANTS = {
  ORDER_NOT_FOUND: "Order not found",
  ALREADY_CANCELED: "Order already canceled",
  ALREADY_UNASSIGNED: "Order already unassigned",
  PICK_THE_ORDER_FIRST: "Order should be picked up first.",
  NOT_AUTHORIZED_FOR_CANCELLATION: "Only authorized user can cancel this order",
  CANCELED: "Order canceled successfully.",
  UNASSIGNED_SUCCESSFULLY: "Driver unassigned successfully.",
  NOT_AVAILABLE: "This is order is no more available to you.",
  ACCEPTED: "Order accepted successfully.",
  REJECTED: "Order rejected successfully.",
  NOT_AUTHORIZED_FOR_PICKUP: "You are not authorized for this order pick up",
  NOT_AUTHORIZED: "Only authorized for this order delivered",
  PICKED_UP: "Order Picked up successfully.",
  DELIVERED: "Order delivered successfully.",
  DRIVED_ARRIVED_AT_STORE: "Driver arrived at store.",
  ITEMS_MATCHED: "Items matched successfully",
  INVALID_STATUS: "Invalid order status",
  UPDATED: "Order updated successfully.",
  ITEMS_ADDED_CART: "Items added to the cart successfully.",
  ALREADY_MARKED_FOR_RETURN: "Order is already marked for return.",
};
const STORE_MANAGER_CONSTANTS = {
  INVALID_FORMAT: "Data format is wrong",
  EMAIL_ALREADY_EXISTS: "Email already registered",
  STORE_MANAGER_DELETED: "Store manager deleted successfully",
  INVALID_LOGIN_CREDENTIALS: "Invalid email or password",
  STORE_MANAGER_NOT_FOUND: "Manager not found",
  NOT_REGISTERED: "not registered with the given data",
  NOT_AUTHORIZED: "You are not authorized to do this",
};
const REFERRAl_CONSTANTS = {
  NO_REFERRAL_AVAILABLE: "You do not have any referral to use.",
};
const COUPON_CONSTANTS = {
  INVALID_COUPON: "Invalid coupon.",
  ALREADY_EXITED: "Coupon already exists.",
  EXPIRED_COUPON: "Coupon expired. Kindly remove the coupon and try again.",
  COUPONFOR_MANDATORY: "couponFor is mandatory query parameter.",
  INVALID_FREE_COUPON: "This coupon is only valid for 18th and 19th March 2020.",
  DUPLICATE_COUPON: "Coupon with the given title already exists.",
  COUPON_SUBMIT_SUCCESS: "Coupon added successfully",
  COUPON_UPDATE_SUCCESS: "Coupon updated successfully",
  COUPON_DELETE_SUCCESS: "Coupon removed successfully",
  COUPON_VALID: "Coupon is valid",
  COUPON_INVALID: "Coupon is Invalid",
  MAX_USER_LIMIT_REACHED: "You have already used this coupon code.",
  MAX_REDEMPTION_REACHED: "This coupon has reached its maximum redemption.",
  NO_COUPON_AVAILABLE: "No coupon is available",
  LESSER_SUBTOTAL_AMOUNT: "Applicable on min order amount of ",
};
const PAYMENT_CONSTANTS = {
  PAYMENT_FAILED: "Payment didn't process.",
  PAYMENT_SUCCESS: "Payment made successfully.",
  AMOUNT_GREATER_THAN_ZERO: "Payment amount should be greater than 0.",
  DATA_MISMATCH: "Data mismatch, please refresh and try again.",
};
const PAYOUT_CONSTANTS = {
  PAYOUT_NOT_FOUND: "Payout not found.",
  PAYOUT_FAILED: "Retry payout failed, Please try after some time.",
};

const VERSION_CONSTANT = {
  SUBMIT_SUCCESS: "Version details added successfully",
  NO_UPDATE: "You are on latest version",
  VERSION_MANDATORY: "Query parameter v is mandatory",
  APP_MANDATORY: "Query parameter app is mandatory",

  APPTYPE_MANDATORY: "Query parameter appType is mandatory",
};

module.exports.ADMIN_CONSTANTS = ADMIN_CONSTANTS;
module.exports.USER_CONSTANTS = USER_CONSTANTS;
module.exports.PAYMENT_CONSTANTS = PAYMENT_CONSTANTS;

module.exports.ORDER_CONSTANTS = ORDER_CONSTANTS;
module.exports.DRIVER_CONSTANTS = DRIVER_CONSTANTS;
module.exports.CART_CONSTANTS = CART_CONSTANTS;
module.exports.CAT_CONSTANTS = CAT_CONSTANTS;
module.exports.OFFER_CONSTANTS = OFFER_CONSTANTS;
module.exports.UNIT_CONSTANTS = UNIT_CONSTANTS;
module.exports.MIDDLEWARE_AUTH_CONSTANTS = MIDDLEWARE_AUTH_CONSTANTS;
module.exports.PRODUCT_CONSTANTS = PRODUCT_CONSTANTS;
module.exports.TOPPING_CONSTANTS = TOPPING_CONSTANTS;
module.exports.VENDOR_CONSTANTS = VENDOR_CONSTANTS;
module.exports.INFLUENCER_CONSTANTS = INFLUENCER_CONSTANTS;
module.exports.STORE_CONSTANTS = STORE_CONSTANTS;
module.exports.OTP_CONSTANTS = OTP_CONSTANTS;
module.exports.AUTH_CONSTANTS = AUTH_CONSTANTS;
module.exports.STORE_MANAGER_CONSTANTS = STORE_MANAGER_CONSTANTS;
module.exports.ADDRESS_CONSTANTS = ADDRESS_CONSTANTS;
module.exports.SUB_CAT_CONSTANTS = SUB_CAT_CONSTANTS;
module.exports.CARD_CONSTANTS = CARD_CONSTANTS;
module.exports.RATING_CONSTANTS = RATING_CONSTANTS;
module.exports.BANNER_CONSTANTS = BANNER_CONSTANTS;
module.exports.COUPON_CONSTANTS = COUPON_CONSTANTS;
module.exports.REFERRAl_CONSTANTS = REFERRAl_CONSTANTS;
module.exports.OTHER_CONSTANTS = OTHER_CONSTANTS;
module.exports.VERSION_CONSTANT = VERSION_CONSTANT;
module.exports.CITY_CONSTANTS = CITY_CONSTANTS;
module.exports.SUBACCOUNT_CONSTANTS = SUBACCOUNT_CONSTANTS;
module.exports.SERVICE_AREA_CONSTANTS = SERVICE_AREA_CONSTANTS;
module.exports.ROLE_CONSTANTS = ROLE_CONSTANTS;
module.exports.PAYOUT_CONSTANTS = PAYOUT_CONSTANTS;

PAYOUT_CONSTANTS;
