const Koa =require('koa')
const Router = require('koa-router')
const koaBody = require('koa-body')
const crypto = require("crypto")
const request = require('request')
const querystring = require('querystring')
const line = require('@line/bot-sdk')

const app = new Koa()
const router = new Router()

const validate_signature = (headers, body) => {
  const {'x-line-signature': signature} = headers
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  return line.validateSignature(body, channelSecret, signature)
}

const getAccessToken = () => {
  const headers = {
    'Content-type': 'application/x-www-form-urlencoded'
  }
  const dataString = querystring.stringify({
    grant_type: 'client_credentials',
    client_id: process.env.LINE_CHANNEL_ID,
    client_secret: process.env.LINE_CHANNEL_SECRET,
  })
  const options = {
    url: 'https://api.line.me/v2/oauth/accessToken',
    method: 'POST',
    headers: headers,
    body: dataString
  }

  return new Promise(resolve => {
    request(options, (error, response, body) => {
      if (!error) {
        resolve(JSON.parse(body))
      }
    })
  })
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

const main = async () => {
  const { access_token: accessToken } = await getAccessToken()

  const config = {
    channelAccessToken: accessToken,
    channelSecret: process.env.LINE_CHANNEL_SECRET
  }

  const client = new line.Client(config) 
  router.post('/callback', koaBody(),
    async (ctx) => {
      ctx.body = JSON.stringify(ctx.request.body)
      if (!validate_signature(ctx.headers, ctx.body)) return
      const event = ctx.request.body['events'][0]
      if (event['type'] == 'message') {
        const message = event['message']
        if (message['type'] == 'text') {
          const source = event['source']
          const userId = source['userId']
          const groupId = source['groupId']
          if (groupId != process.env.LINE_GROUP_ID) return
          const { displayName, pictureUrl } = await client.getProfile(userId)
          postToSlack({text: `*${displayName}*\n>>>${message.text}`})
        }
      }
    }
  )

  app.use(router.routes())
    .use(router.allowedMethods())

  app.listen(process.env.PORT || 3000)
}

main().then(() => {})
