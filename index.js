/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */

const getConfig = require('probot-config')
const needsTriagingLabel = 'needs-triaging'

module.exports = async app => {
  app.log('Selenium Assistant has started!')

  app.on('issues.opened', triageOpenedIssues)

  async function triageOpenedIssues (context) {
    const config = await getConfig(context, 'selenium-assistant.yml')
    if (!context.isBot && config) {
      // The bot greets the user first
      let comment = context.issue({ body: config.openIssueGreetingComment })
      await context.github.issues.createComment(comment)
      const issueBody = context.payload.issue.body.toLowerCase()
      if (issueBody.includes('💬') || issueBody.includes('questions and help')) {
        // It is a question, the bot closes it
        comment = context.issue({ body: config.closeQuestionsAndSupportRequestsComment })
        await context.github.issues.createComment(comment)
        if (config.closeQuestionsAndSupportRequests) {
          await context.github.issues.update({
            owner: context.issue().owner,
            repo: context.issue().repo,
            issue_number: context.issue().number,
            state: 'closed'
          })
        }
      } else {
        // The bot cannot triage it, it labels the issue
        await ensureNeedsTriagingLabelExists(context)
        return context.github.issues.addLabels({
          owner: context.issue().owner,
          repo: context.issue().repo,
          issue_number: context.issue().number,
          labels: [needsTriagingLabel]
        })
      }
    }
  }

  async function ensureNeedsTriagingLabelExists (context) {
    return context.github.issues.getLabel({
      owner: context.issue().owner,
      repo: context.issue().repo,
      name: needsTriagingLabel
    }).catch(() => {
      return context.github.issues.createLabel({
        owner: context.issue().owner,
        repo: context.issue().repo,
        name: needsTriagingLabel,
        color: 'ffffff'
      })
    })
  }
}
