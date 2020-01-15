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
      const issueBody = context.payload.issue.body
      if (await issueIsAQuestionOrSupportRequest(issueBody, config)) {
        await greetUser(context, config)
        // Post comment indicating that this is a question or a request for support
        await postComment(context, config.closeQuestionsAndSupportRequestsComment)
        if (config.closeQuestionsAndSupportRequests) {
          // If enabled in the config, close the issue
          await closeIssue(context)
        }
      } else if (!await issueIsOneOfTheSupportedTypes(issueBody, config)) {
        await greetUser(context, config)
        // Issue does not start with any of the configured strings, therefore this is not a supported issue type
        // Post a comment indicating that this is not a supported issue type
        await postComment(context, config.closeNotSupportedIssueTypesComment)
        if (config.closeNotSupportedIssueTypes) {
          // If enabled in the config, close the issue
          await closeIssue(context)
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

  async function greetUser (context, config) {
    if (config.openIssueGreetingComment) {
      const comment = context.issue({ body: config.openIssueGreetingComment })
      return context.github.issues.createComment(comment)
    }
  }

  async function issueIsAQuestionOrSupportRequest (issueBody, config) {
    if (config.questionsAndSupportRequestsStrings) {
      return config.questionsAndSupportRequestsStrings.some((questionsAndSupportRequestsString) => {
        return issueBody.toLowerCase().includes(questionsAndSupportRequestsString.toLowerCase())
      })
    }
  }

  async function issueIsOneOfTheSupportedTypes (issueBody, config) {
    if (config.issueTypes) {
      return config.issueTypes.some((issueType) => {
        return issueBody.toLowerCase().startsWith(issueType.toLowerCase())
      })
    }
  }

  async function postComment (context, commentBody) {
    const comment = context.issue({ body: commentBody })
    return context.github.issues.createComment(comment)
  }

  async function closeIssue (context) {
    return context.github.issues.update({
      owner: context.issue().owner,
      repo: context.issue().repo,
      issue_number: context.issue().number,
      state: 'closed'
    })
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
