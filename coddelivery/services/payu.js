const crypto = require('crypto');
const axios = require('axios');
const { URLSearchParams } = require('url')
// const MERCHANT_KEY = 'APhsSo'
// const SALT = 'vmatbF2QqhhgXcykbPsB39kumiKShXM8'
// const CLIENT_ID = 'b4241eccdc25ac41c6026bb85eea22fa664967207ac52b0bb2e7622b8ba097b7'
// const CLIENT_SECRET = '78e76cfc0066f1e3c7e136861feee5a24500f44a115323b7d625378bde00bbcb'
// const { URLSearchParams } = require('url')
// const MERCHANT_ID = '8246178'
const MERCHANT_KEY = 'Y9gEpa'
const SALT = 'Utx4YpHba8ApYst5qjCfGsEZFhGtidAx'
const CLIENT_ID = 'f8f95f02d001641231441a7d0f3e98e3009e4ebbee0560388571e255029a6335'
const CLIENT_SECRET = 'd6a3b8cb8b515f5e96461d8c4aa6b4055d363565224e98ecfa2762d9b1040177'
const MERCHANT_ID = '8246365'


// function generateHashAndString(params) {
//     // Replace 'yourSalt' with your actual salt value
//     const salt = SALT
//     const keyValuePairs = [];
//     // Iterate over keys in params
//     for (const key in params) {
//         // Skip properties from the object's prototype chain
//         if (params.hasOwnProperty(key)) {
//             // Add key and value to the array
//             keyValuePairs.push(`${params[key]}`);
//         }
//     }
//     // Join key-value pairs with '|'
//     const concatenatedString = keyValuePairs.join('|') + `|${salt}`;
//     // Calculate SHA-512 hash
//     const hash = crypto.createHash('sha512');
//     hash.update(concatenatedString);
//     const calculatedHash = hash.digest('hex');
//     console.log(calculatedHash)
//     return {
//         hash: calculatedHash,
//         formattedString: concatenatedString,
//     };
// }

// // Example usage
const params = {
    key: MERCHANT_KEY,
    txnid: '134324sdsd3fds',
    amount: 1100,
    productinfo: 'phone',
    firstname: 'lovely',
    email: 'lo@g.in',
    surl: 'https://test-payment-middleware.payu.in/simulatorResponse',
    furl: 'https://test-payment-middleware.payu.in/simulatorResponse',
    phone: 9123435667,
}

const getToken = async ({ scope }) => {
    const finalResponse = {}
    try {
        const encodedParams = new URLSearchParams();
        encodedParams.set('client_id', CLIENT_ID);
        encodedParams.set('client_secret', CLIENT_SECRET);
        encodedParams.set('grant_type', 'client_credentials');
        encodedParams.set('scope', scope);
        const options = {
            method: 'POST',
            url: 'https://uat-accounts.payu.in/oauth/token',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: encodedParams,
        };
        let response = await axios.request(options)
        response = response.data
        finalResponse.statusCode = 200;
        finalResponse.message = "Success";
        finalResponse.data = response;
        console.log("response", finalResponse);
        return finalResponse
    }
    catch (error) {
        finalResponse.statusCode = error.status;
        finalResponse.message = "Failure";
        finalResponse.data = error.data;
        console.log("error", error);
        return finalResponse
    }
}

const createPaymentLink = async (payload) => {
    let finalResponse = {};
    try {
        const tokenResp = await getToken({ scope: 'create_payment_links' })
        const token = tokenResp.data.access_token
        const options = {
            method: 'POST',
            url: 'https://uatoneapi.payu.in/payment-links',
            headers: {
                merchantId: MERCHANT_ID,
                'content-type': 'application/json',
                authorization: `Bearer ${token}`
            },
            data: {
                isPartialPaymentAllowed: false,
                customer: { name: payload.name, email: payload.email, phone: payload.phone },
                subAmount: payload.amount,
                description: 'For payment',
                source: 'API',
                udf: {
                    udf1: payload.userId,
                    udf2: payload.orderId,
                    udf3: payload.appType,
                    udf4: payload?.paymentType || 'default',
                    udf5: payload?.driverId || ''
                },
            }
        };
        let response = await axios.request(options)
        response = response.data
        finalResponse.statusCode = 200;
        finalResponse.message = "Success";
        finalResponse.data = response;
        console.log("response", finalResponse);
    } catch (error) {
        finalResponse.statusCode = error.status;
        finalResponse.message = "Failure";
        finalResponse.data = error.data;
        console.log("error", error);
    }
    return finalResponse;
}
// createPaymentLink({
//     name: 'lovely',
//     email: 'lovelyzimble@yopmail.com',
//     amount: 300,
//     phone: '9988776677',
//     transactionId: 'dkjfasj324r23',
//     userId: '32432rew',
//     orderId: 'asdfsdafsadfs',
//     appType: 'mobile'
// })

const getPayUHostedPayment = async () => {
    const encodedParams = new URLSearchParams();
    encodedParams.set('key', 'JPM7Fg');
    encodedParams.set('surl', 'https://test-payment-middleware.payu.in/simulatorResponse');
    encodedParams.set('furl', 'https://test-payment-middleware.payu.in/simulatorResponse');
    encodedParams.set('txnid', '123sd2ss13defds');
    encodedParams.set('amount', '11123');
    encodedParams.set('productinfo', 'phone');
    encodedParams.set('firstname', 'lovlu');
    encodedParams.set('email', 'lov@gmail.com');
    encodedParams.set('phone', '8899123341');
    encodedParams.set('hash', '8ee03562efc5621dc2e8ccbf05d2227e722c95fc84a13d6e43c0d3241c552c40e921aecf6f20c470a5600eac73dd41e26c48c051030c739d58c31554cb48e1d4');

    const options = {
        method: 'POST',
        url: 'https://test.payu.in/merchant/_payment',
        headers: { accept: 'text/plain', 'Content-Type': 'application/x-www-form-urlencoded' },
        data: encodedParams,
    };

    const resp = await axios.request(options)
    console.log(resp)
    // console.log('data', resp.data)
    // console.log(res?.json())
    // console.log('res', resp.res)
    // console.log('res', resp.res._redirectable)
    // console.log('res', resp.res.responseUrl)
    // JSON.parse(resp.data)``
    return resp
}
// getPayUHostedPayment()

const serverToServerCardPayment = async () => {
    const encodedParams = new URLSearchParams();
    encodedParams.set('key', 'JP***g');
    encodedParams.set('amount', '10.00');
    encodedParams.set('txnid', 'txnid70437249408');
    encodedParams.set('firstname', 'PayU User');
    encodedParams.set('email', 'test@gmail.com');
    encodedParams.set('phone', '9876543210');
    encodedParams.set('productinfo', 'iPhone');
    encodedParams.set('surl', 'https://test-payment-middleware.payu.in/simulatorResponse');
    encodedParams.set('furl', 'https://test-payment-middleware.payu.in/simulatorResponse');
    encodedParams.set('pg', 'cc');
    encodedParams.set('bankcode', 'cc');
    encodedParams.set('ccnum', '5123456789012346');
    encodedParams.set('ccexpmon', '05');
    encodedParams.set('ccexpyr', '2024');
    encodedParams.set('ccvv', '123');
    encodedParams.set('ccname', '');
    encodedParams.set('txn_s2s_flow', '4');
    encodedParams.set('hash', 'c80107f937d10b3faeb4dddc7f19502f0913925674eacd20884f6ba37db3e4e319dbe6ed4f54e94bf81f4bb46f2922468d85d26eaa3f4131251aabf53f22ca19');
    const url = 'https://test.payu.in/merchant/_payment';
    // const options = { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: encodedParams };
    const options = {
        method: 'POST',
        url: url,
        headers: { accept: 'text/plain', 'Content-Type': 'application/x-www-form-urlencoded' },
        data: encodedParams,
    };

    const resp = await axios.request(options)
    console.log(resp.data)
}

const func2 = async () => {
    try {
        const axios = require('axios');
        const { URLSearchParams } = require('url');

        const encodedParams = new URLSearchParams();
        encodedParams.set('grant_type', 'client_credentials');
        encodedParams.set('scope', 'create_payout_transactions');
        encodedParams.set('client_id', 'b4241eccdc25ac41c6026bb85eea22fa664967207ac52b0bb2e7622b8ba097b7');
        encodedParams.set('client_secret', '78e76cfc0066f1e3c7e136861feee5a24500f44a115323b7d625378bde00bbcb');

        const options = {
            method: 'POST',
            url: 'https://uat-accounts.payu.in/oauth/token?form=2',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: encodedParams,
        };

        axios
            .request(options)
            .then(function (response) {
                console.log(response.data);
            })
            .catch(function (error) {
                console.error(error);
            });
    }
    catch (e) {
        console.log(e)
    }
}

const createSubMerchant = async (payload) => {
    let finalResponse = {};
    try {
        const tokenResp = await getToken({ scope: 'refer_child_merchant' })
        const token = tokenResp.data.access_token
        const options = {
            method: 'POST',
            url: 'https://uat-onepayuonboarding.payu.in',
            headers: {
                merchantId: MERCHANT_ID,
                'content-type': 'application/json',
                authorization: `Bearer ${token}`
            },
            data: {
                // static values
                product: 'PayUBiz',
                aggregator_parent_mid: MERCHANT_ID,
                merchant_type: 'aggregator',
                // merchant details
                name: payload.name,
                email: payload.email,
                business_entity_id: payload.businessEntityId,
                pancard_number: payload.pancardNumber,
                pancard_name: payload.pancardName,
                business_category_id: payload.businessCategoryId,
                business_sub_category_id: payload.businessSubCategoryId,
                gst_number: payload.gstNumber,
                monthly_expected_volume: payload.monthlyExpectedVolume,
                business_name: payload.businessName,
                bank_detail: {
                    bank_account_number: payload.accountNumber,
                    holder_name: payload.holderName,
                    ifsc_code: payload.ifsc
                }
            }
        };
        let response = await axios.request(options)
        response = response.data
        finalResponse.statusCode = 200;
        finalResponse.message = "Success";
        finalResponse.data = response;
        console.log("response", finalResponse);
    } catch (error) {
        finalResponse.statusCode = error.status;
        finalResponse.message = "Failure";
        finalResponse.data = error.data;
        console.log("error", error);
    }
    return finalResponse;
}
// createSubMerchant()
const splitByPercentage = async (payload) => {
    let finalResponse = {};
    try {
        const options = {
            method: 'POST',
            url: 'https://test.payu.in/_payment',
            data: {
                type: 'percentage',
                payuid: '403993715525003544',
                splitInfo: {
                    aggregatorSubTxnId: 'sdf',
                    aggregatorSubAmt: 30,
                    aggregatorCharges: 70
                }
            }
        };
        let response = await axios.request(options)
        response = response.data
        finalResponse.statusCode = 200;
        finalResponse.message = "Success";
        finalResponse.data = response;
        console.log("response", finalResponse);
    } catch (error) {
        finalResponse.statusCode = error.status;
        finalResponse.message = "Failure";
        finalResponse.data = error.data;
        console.log("error", error);
    }
    return finalResponse;
}
const settleSplitPayment = async (payload) => {
    let finalResponse = {};
    try {
        const options = {
            method: 'POST',
            url: 'https://test.payu.in/merchant/',
            // headers: {
            // merchantId: MERCHANT_ID,
            // 'content-type': 'application/json',
            // authorization: `Bearer ${token}`
            // },
            data: {
                key: MERCHANT_KEY,
                command: 'release_settlement',
                hash: 'key|command|var1|salt',
                var1: 'mihpayuId',
                var2: 'childMid'
            }
        };
        let response = await axios.request(options)
        response = response.data
        finalResponse.statusCode = 200;
        finalResponse.message = "Success";
        finalResponse.data = response;
        console.log("response", finalResponse);
    } catch (error) {
        finalResponse.statusCode = error.status;
        finalResponse.message = "Failure";
        finalResponse.data = error.data;
        console.log("error", error);
    }
    return finalResponse;
}

const generateHash = async (string) => {
    try {
        const hash = crypto.createHash('sha256').update(string).digest('hex');
        return hash
    }
    catch (e) {
        console.log(e)
        return false
    }
}
// func2()
module.exports = {
    createPaymentLink,
    createSubMerchant
}