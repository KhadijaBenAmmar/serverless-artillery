'use strict';

module.exports = {
    myAfterResponseHandler: myAfterResponseHandler,
    beforeResponse: beforeResponse,
};

function myAfterResponseHandler(requestParams, response, context, ee, next) {
    console.log('********************************************************')
    console.log('********************************************************\n\n')

    console.log(requestParams);
    console.log(response);
    // console.log(context);
    // console.log(ee);
    // console.log(next);

    console.log('\n\n********************************************************')
    console.log('********************************************************\n\n')

}

function beforeResponse(requestSpec, ee, data, response, context) {
  // console.log('requestSpec', requestSpec)
  // console.log('data', data)
  if (data && data.sender_action === 'typing_on') {

    return false
  }
  return true
}
