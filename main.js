const Koa =require('koa')
const Router = require('koa-router')
const koaBody = require('koa-body')
const crypto = require("crypto")
const request = require('request')

const app = new Koa()
const router = new Router()

const validate_signature = (signature, json) => {
  return signature == crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(new Buffer(json, 'utf8')).digest('base64')
}

const postToSlack = ({ text }) => {
  const headers = {
    'Content-type': 'application/json'
  }
  const dataString = JSON.stringify({text: text})
  const options = {
    url: process.env.SLACK_API_URL,
    method: 'POST',
    headers: headers,
    body: dataString
  }

  request(options, (error, response, body) => {
    if (error) {
      // TODO error message
    }
  })
}

router.post('/callback', koaBody(),
  (ctx) => {
    console.log(ctx.request.headers['x-line-signature'])
    ctx.body = JSON.stringify(ctx.request.body)
    console.log(ctx.body)
    if (!validate_signature(ctx.headers['x-line-signature'], ctx.body)) return
    const event = ctx.request.body['events'][0]
    if (event['type'] == 'message') {
      const message = event['message']
      if (message['type'] == 'text') {
        const source = event['source']
        const userId = source['userId'] // TODO const userName = fetchUserNamebyId(userId)
        const groupId = source['groupId']
        if (groupId != process.env.LINE_GROUP_ID) return
        postToSlack({text: message.text})
      }
    }
  }
)

app.use(router.routes())
  .use(router.allowedMethods())

app.listen(process.env.PORT || 3000)
