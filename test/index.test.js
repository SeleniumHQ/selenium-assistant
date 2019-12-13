const nock = require('nock')
// Requiring our app implementation
const seleniumAssistant = require('..')
const { Probot } = require('probot')
// Requiring our fixtures
const issueToBeClosed = require('./fixtures/issues.question_to_be_closed')
const issueToBeTriaged = require('./fixtures/issues.needs_to_be_triaged')
const config = require('./fixtures/repos.contents.config')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const apiBasePath = 'https://api.github.com'

describe('Selenium Assistant', () => {
  let probot
  let mockCert
  let repoConfigContent

  beforeAll((done) => {
    fs.readFile(path.join(__dirname, 'fixtures/mock-cert.pem'), (err, cert) => {
      if (err) return done(err)
      mockCert = cert
      done()
    })
    repoConfigContent = yaml.safeLoad(Buffer.from(config.content, 'base64').toString()) || {}
  })

  beforeEach(() => {
    nock.disableNetConnect()
    probot = new Probot({ id: 123, cert: mockCert })
    // Load our app into probot
    probot.load(seleniumAssistant)
  })

  test('closes issue when a question or a support request is created', async () => {
    // Test that we correctly return the repo config
    nock(apiBasePath)
      .get('/repos/seleniumhq/testing-things/contents/.github/selenium-assistant.yml')
      .reply(200, config)

    // Test that a greeting comments and a closing comment are posted
    nock(apiBasePath)
      .post('/repos/seleniumhq/testing-things/issues/1/comments', (body) => {
        expect(body).toMatchObject({ body: repoConfigContent.openIssueGreetingComment })
        return true
      })
      .reply(200)

    nock(apiBasePath)
      .post('/repos/seleniumhq/testing-things/issues/1/comments', (body) => {
        expect(body).toMatchObject({ body: repoConfigContent.closeQuestionsAndSupportRequestsComment })
        return true
      })
      .reply(200)

    // Test that the issue is closed
    nock(apiBasePath)
      .patch('/repos/seleniumhq/testing-things/issues/1', (body) => {
        expect(body).toMatchObject({ state: 'closed' })
        return true
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'issues', payload: issueToBeClosed })
  })

  test('new issues which are not questions get a greeting and a label', async () => {
    // Test that we correctly return the repo config
    nock(apiBasePath)
      .get('/repos/seleniumhq/testing-things/contents/.github/selenium-assistant.yml')
      .reply(200, config)

    // Test that a greeting comments and a closing comment are posted
    nock(apiBasePath)
      .post('/repos/seleniumhq/testing-things/issues/1/comments', (body) => {
        expect(body).toMatchObject({ body: repoConfigContent.openIssueGreetingComment })
        return true
      })
      .reply(200)

    // Test that it checks if the label exists
    nock(apiBasePath)
      .get('/repos/seleniumhq/testing-things/labels/needs-triaging')
      .reply(404, {
        message: 'Not Found',
        documentation_url: 'https://developer.github.com/v3/issues/labels/#get-a-single-label'
      })

    // Create the label since it does not exist
    nock(apiBasePath)
      .post('/repos/seleniumhq/testing-things/labels', (body) => {
        expect(body).toMatchObject({ name: 'needs-triaging', color: 'ffffff' })
        return true
      })
      .reply(200)

    // Add the label to the issue
    nock(apiBasePath)
      .post('/repos/seleniumhq/testing-things/issues/1/labels', (body) => {
        console.log(body)
        expect(body).toContain('needs-triaging')
        return true
      })
      .reply(200)

    // Receive a webhook event
    await probot.receive({ name: 'issues', payload: issueToBeTriaged })
  })

  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })
})
