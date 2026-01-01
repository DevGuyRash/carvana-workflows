---
title: "Advanced searching - functions reference | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-functions-reference-1488596777.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
This page describes information about functions that are used for advanced searching.

A function in JQL appears as a word followed by parentheses, which may contain one or more explicit values or Jira [system][1] fields. In a clause, a function is preceded by an [operator][2], which in turn is preceded by a  [field][3]. A function performs a calculation on either specific Jira data or the function's content in parentheses, such that only true results are retrieved by the function, and then again by the clause in which the function is used.

Some Jira apps can add additional functions to the advanced issue search. For example, theScriptRunner for JIRA app extends JQL with such functions as `myProjects() and projectmatch()`.

Unless specified in the search query, note that JQL searches don't return empty fields in results. To include empty fields (e.g. unassigned issues) when searching for issues that are not assigned to the current user, you would enter (assignee!= currentUser() OR assignee is EMPTY) to include unassigned issues in the list of results.

## approved()

*Only applicable if Jira Service Management is installed and licensed.*

Search for issues that required approval and have a final decision of approved.

| Syntax | `approved()` |
| --- | --- |
| Supported fields | Custom fields of type Approval |
| Supported operators | = |
| Unsupported operators | `~ , != , !~ ,` >, >=, <, <= / `IS , IS NOT , IN , NOT IN ,` `WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find all issues that are approved: Approvals = approved(); Find all issues that have been approved by you or are pending your approval: Approvals = myApproval() OR Approvals = myPending() |

**[^ top of page][4]**

## approver()

*Only applicable if Jira Service Management is installed and licensed.*

Search for issues that require or required approval by one or more of the listed users. This uses an `OR` operator, and you must specify the usernames.

| Syntax | `approver(user,user)` |
| --- | --- |
| Supported fields | Custom fields of type Approval |
| Supported operators | = |
| Unsupported operators | `~ , != , !~ , > , >= , < , <= / IS , IS NOT , IN , NOT IN , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that require or required approval by John Smith: approval = approver(jsmith); Find issues that require or required approval by John Smith or Sarah Khan: approval = approver(jsmith,skhan) |

**[^ top of page][4]**

## breached()

*Only applicable if Jira Service Management is installed and licensed.*

Returns issues that whose most recent has missed its goal.

| Syntax | `breached()` |
| --- | --- |
| Supported fields |  |
| Supported operators | `= , !=` |
| Unsupported operators | `~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues where Time to First Response was breached: "Time to First Response" = breached() |

**[^ top of page][4]**

## cascadeOption()

Search for issues that match the selected values of a "cascading select" custom field.

The `parentOption`  parameter matches against the first tier of options in the cascading select field. The  `childOption` parameter matches against the second tier of options in the cascading select field, and is optional.

The keyword `"none"` can be used to search for issues where either or both of the options have no value.

| Syntax | `cascadeOption(parentOption)` `cascadeOption(parentOption,childOption)` |
| --- | --- |
| Supported fields | Custom fields of type "Cascading Select" |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues where a custom field ("Location") has the value "USA" for the first tier and "New York" for the second tier: location in cascadeOption("USA","New York"); Find issues where a custom field ("Location") has the value "USA" for the first tier and any value (or no value) for the second tier: location in cascadeOption( "USA" ); Find issues where a custom field ("Location") has the value "USA" for the first tier and no value for the second tier: location in cascadeOption( "USA" ,none); Find issues where a custom field ("Location") has no value for the first tier and no value for the second tier: location in cascadeOption(none); Find issues where a custom field ("Referrer") has the value "none" for the first tier and "none" for the second tier: referrer in cascadeOption( "\"none\"" , "\"none\"" ); Find issues where a custom field ("Referrer") has the value "none" for the first tier and no value for the second tier: referrer in cascadeOption( "\"none\"" ,none) |

**[^ top of page][4]**

## closedSprints()

Search for issues that are assigned to a completed Sprint.

It's possible for an issue to belong to both a completed Sprint(s) and an incomplete Sprint(s). See also [openSprints()][5].

| Syntax | `closedSprints()` |
| --- | --- |
| Supported fields | Sprint |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= / IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find all issues that are assigned to a completed sprint: sprint in closedSprints() |

**[^ top of page][4]**

## completed()

*Only applicable if Jira Service Management is installed and licensed.*

Returns issues that have an that has completed at least one cycle.

| Syntax | `completed()` |
| --- | --- |
| Supported fields |  |
| Supported operators | `= , !=` |
| Unsupported operators | =, `~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues where Time to First Response has completed at least one cycle: "Time to First Response" = completed() |

**[^ top of page][4]**

## componentsLeadByUser()

Find issues in components that are led by a specific user. You can optionally specify a user, or if the user is omitted, the current user (i.e. you) will be used.

If you are not logged in to Jira, a user must be specified.

| Syntax | `componentsLeadByUser()` `componentsLeadByUser(username)` |
| --- | --- |
| Supported fields | Component |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find open issues in components that are led by you: component in componentsLeadByUser() AND status = Open; Find open issues in components that are led by Bill: component in componentsLeadByUser(bill) AND status = Open |

**[^ top of page][4]**

## currentLogin()

Perform searches based on the time at which the current user's session began. See also [lastLogin()][6].

| Syntax | `currentLogin()` |
| --- | --- |
| Supported fields | Created, Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `* Only in predicate` |
| Unsupported operators | `~ , !~ , IS , IS NOT , IN , NOT IN` |
| Examples | Find issues that have been created during my current session: created > currentLogin() |

**[^ top of page][4]**

## currentUser()

Perform searches based on the currently logged-in user.

This function can only be used by logged-in users. If you are creating a saved filter that you expect to be used by anonymous users, don't use this function.

| Syntax | `currentUser()` |
| --- | --- |
| Supported fields | Assignee, Reporter, Voter, Watcher, custom fields of type User |
| Supported operators | `= , !=` |
| Unsupported operators | `~ , !~ , > , >= , < , <= , IS , IS NOT , IN , NOT IN , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that are assigned to me: assignee = currentUser(); Find issues that were reported to me but are not assigned to me: reporter = currentUser() AND (assignee != currentUser() OR assignee is EMPTY) |

**[^ top of page][4]**

## earliestUnreleasedVersion()

Perform searches based on the earliest unreleased version (i.e. next version that is due to be released) of a specified project. See also [unreleasedVersions][7].

Consider that the "earliest" is determined by the ordering assigned to the versions, not by actual Version Due Dates.

| Syntax | `earliestUnreleasedVersion(project)` |
| --- | --- |
| Supported fields | AffectedVersion, FixVersion, custom fields of type Version |
| Supported operators | `= , != , ~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Unsupported operators | `IN , NOT IN` |
| Examples | Find issues whose FixVersion is the earliest unreleased version of the ABC project: fixVersion = earliestUnreleasedVersion(ABC); Find issues that relate to the earlist unreleased version of the ABC project: affectedVersion = earliestUnreleasedVersion(ABC) or fixVersion = earliestUnreleasedVersion(ABC) |

**[^ top of page][4]**

## elapsed()

*Only applicable if Jira Service Management is installed and licensed.*

Returns issues whose clock is at a certain point relative to a cycle's start event.

| Syntax | `elapsed()` |
| --- | --- |
| Supported fields |  |
| Supported operators | `= , != , > , >= , < , <=` |
| Unsupported operators | `~ , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that have been waiting for a first response for more than 1 hour: "Time to First Response" > elapsed("1h") |

**[^ top of page][4]**

## endOfDay()

Perform searches based on the end of the current day. See also [endOfWeek()][8], [endOfMonth()][9], and [endOfYear()][10], [startOfDay()][11], [startOfWeek()][12], [startOfMonth()][13], and [startOfYear()][14].

| Syntax | `endOfDay()` `endOfDay("inc")` where `inc` is an optional increment of `(+/-)nn(y|M|w|d|h|m).` If the time unit qualifier is omitted, it defaults to the natural period of the function, e.g. endOfDay("+1") is the same as endOfDay("+1d"). If the plus/minus (+/-) sign is omitted, plus is assumed. |
| --- | --- |
| Supported fields | Created, Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ , IS , IS NOT , IN , NOT IN` |
| Examples | Find issues due by the end of today: due < endOfDay(); Find issues due by the end of tomorrow: due < endOfDay("+1") |

**[^ top of page][4]**

## endOfMonth()

Perform searches based on the end of the current month. See also [endOfDay()][15], [endOfWeek()][8], [endOfYear()][10], [startOfDay()][11], [startOfWeek()][12], [startOfMonth()][13], and [startOfYear()][14].

| Syntax | `endOfMonth()` `endOfMonth("inc")` where `inc` is an optional increment of `(+/-)nn(y|M|w|d|h|m).` If the time unit qualifier is omitted, it defaults to the natural period of the function, e.g. endOfMonth("+1") is the same as endOfMonth("+1M"). If the plus/minus (+/-) sign is omitted, plus is assumed. |
| --- | --- |
| Supported fields | Created, Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ , IS , IS NOT , IN , NOT IN` |
| Examples | Find issues due by the end of this month: due <= endOfMonth(); Find issues due by the end of next month: due <= endOfMonth("+1"); Find issues due by the 15th of next month: due <= endOfMonth("+15d") |

**[^ top of page][4]**

## endOfWeek()

Perform searches based on the end of the current week. See also [endOfDay()][15], [endOfMonth()][9], [endOfYear()][10], [startOfDay()][11], [startOfWeek()][12], [startOfMonth()][13], and [startOfYear][14].

For the `endOfWeek()` function, the result depends upon your locale. For example, in Europe, the first day of the week is generally considered to be Monday, while in the USA, it is considered to be Sunday.

| Syntax | `endOfWeek()` `endOfWeek("inc")` where `inc` is an optional increment of `(+/-)nn(y|M|w|d|h|m).` If the time unit qualifier is omitted, it defaults to the natural period of the function, e.g. endOfWeek("+1") is the same as endOfWeek("+1w"). If the plus/minus (+/-) sign is omitted, plus is assumed. |
| --- | --- |
| Supported fields | Created, Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ , IS , IS NOT , IN , NOT IN` |
| Examples | Find issues due by the end of this week: due < endOfWeek(); Find issues due by the end of next week: due < endOfWeek("+1") |

**[^ top of page][4]**

## endOfYear()

Perform searches based on the end of the current year. See also [startOfDay()][11], [startOfWeek()][12], [startOfMonth()][13], [endOfDay()][15], [endOfWeek()][8], [endOfMonth()][9], and [endOfYear()][10].

| Syntax | `endOfYear()` `endOfYear("inc")` where `inc` is an optional increment of `(+/-)nn(y|M|w|d|h|m).` If the time unit qualifier is omitted, it defaults to the natural period of the function, e.g. endOfYear("+1") is the same as endOfYear("+1y"). If the plus/minus (+/-) sign is omitted, plus is assumed. |
| --- | --- |
| Supported fields | Created, Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ , IS , IS NOT , IN , NOT IN` |
| Examples | Find issues due by the end of this year: due < endOfYear(); Find issues due by the end of March next year: due < endOfYear("+3M") |

**[^ top of page][4]**

## everbreached()

*Only applicable if Jira Service Management is installed and licensed.*

Returns issues that have missed one of their goals.

| Syntax | `elapsed()` |
| --- | --- |
| Supported fields |  |
| Supported operators | `= , !=` |
| Unsupported operators | `~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues have missed their goal for Time to First Response: "Time to First Response" = everbreached() |

**[^ top of page][4]**

## futureSprints()

Search for issues that are assigned to a sprint that hasn't been started yet.

It is possible for an issue to belong to both completed and incomplete sprints.

| Syntax | `futureSprints()` |
| --- | --- |
| Supported fields | Sprint |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= / IS , IS NOT, WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find all issues that are assigned to a sprint that hasn't been started yet: sprint in futureSprints() |

**[^ top of page][4]**

## issueHistory()

Find issues that you have recently viewed, i.e. issues that are in the **Recent Issues**  section of the **Issues** dropdown menu.

Note that:

- `issueHistory()` returns up to 60 issues, whereas the **Recent Issues** drop-down returns only 5.
- if you are not logged in to Jira, only issues from your current browser session will be included.
- issues older than 90 days are deleted daily by the scheduled job.

| Syntax | `issueHistory()` |
| --- | --- |
| Supported fields | Issue |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <=` `, IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues which I have recently viewed, that are assigned to me: issue in issueHistory() AND assignee = currentUser() |

**[^ top of page][4]**

## issuesWithRemoteLinksByGlobalId()

Perform searches based on issues that are associated with remote links that have any of the specified global IDs.

This function accepts 1 to 100 globalIds. Specifying 0 or more than 100 globalIds will result in errors.

| Syntax | `issuesWithRemoteLinksByGlobalId()` |
| --- | --- |
| Supported fields | Issue |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <=` `, IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that are linked to remote links that have globalId "abc": issue in issuesWithRemoteLinksByGlobalId(abc); Find issues that are linked to remote links that have either globalId "abc" or "def": issue in issuesWithRemoteLinksByGlobalId(abc, def) |

**[^ top of page][4]**

## lastLogin()

Perform searches based on the time at which the current user's previous session began. See also [currentLogin()][16].

| Syntax | `lastLogin()` |
| --- | --- |
| Supported fields | Created. Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ ,` `IS , IS NOT , IN , NOT IN` |
| Examples | Find issues that have been created during my last session: created > lastLogin() |

**[^ top of page][4]**

## latestReleasedVersion()

Perform searches based on the latest released version (i.e. the most recent version that has been released) of a specified project. See also [releasedVersions()][17].

Consider that the "latest" is determined by the ordering assigned to the versions, not by actual Version Due Dates.

| Syntax | `latestReleasedVersion(project)` |
| --- | --- |
| Supported fields | AffectedVersion, FixVersion, custom fields of type Version |
| Supported operators | `= , !=` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `IS , IS NOT , IN , NOT IN ,` `WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues whose FixVersion is the latest released version of the ABC project: fixVersion = latestReleasedVersion(ABC); Find issues that relate to the latest released version of the ABC project: affectedVersion = latestReleasedVersion(ABC) or fixVersion = latestReleasedVersion(ABC) |

**[^ top of page][4]**

## linkedIssues()

Perform searches based on issues that are linked to a specified issue. You can optionally restrict the search to links of a particular type.

Note that LinkType is case-sensitive.

| Syntax | `linkedIssues(issueKey)` `linkedIssues(issueKey,linkType)` |
| --- | --- |
| Supported fields | Issue |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <=` `, IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that are linked to a particular issue: issue in linkedIssues(ABC-123); Find issues that are linked to a particular issue via a particular type of link: issue in linkedIssues(ABC-123,"is duplicated by") |

**[^ top of page][4]**

## membersOf()

Perform searches based on the members of a particular group.

| Syntax | `membersOf(Group)` |
| --- | --- |
| Supported fields | Assignee, Reporter, Voter, Watcher, custom fields of type User |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <=` `, IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues where the Assignee is a member of the group "Jira-administrators": assignee in membersOf("Jira-administrators"); Search through multiple groups and a specific user: reporter in membersOf("Jira-administators") or reporter in membersOf("Jira-core-users") or reporter=jsmith; Search for a particular group, but exclude a particular member or members: assignee in membersOf() and assignee not in ("John Smith","Jill Jones"); Exclude members of a particular group: assignee not in membersOf() |

**[^ top of page][4]**

## myApproval()

*Only applicable if Jira Service Management is installed and licensed.*

Search for issues that require approval or have required approval by the current user.

| Syntax | `myApproval()` |
| --- | --- |
| Supported fields | Custom fields of type Approval |
| Supported operators | = |
| Unsupported operators | `~ , != , !~ ,` >, >=, <, <= / `IS , IS NOT , IN , NOT IN ,` `WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find all issues that require or have required my approval approval = myApproval() |

**[^ top of page][4]**

## myPending()

*Only applicable if Jira Service Management is installed and licensed.*

Search for issues that require approval by the current user.

| Syntax | `myPending()` |
| --- | --- |
| Supported fields | Custom fields of type Approval |
| Supported operators | = |
| Unsupported operators | `~ , != , !~ ,` >, >=, <, <= / `IS , IS NOT , IN , NOT IN ,` `WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find all issues that require my approval approval = myPending() |

**[^ top of page][4]**

## now()

Perform searches based on the current time.

| Syntax | `now()` |
| --- | --- |
| Supported fields | Created. Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ ,` `IS , IS NOT , IN , NOT IN` |
| Examples | Find issues that are overdue: duedate < now() and status not in (closed, resolved) |

**[^ top of page][4]**

## openSprints()

Search for issues that are assigned to a Sprint that has not yet been completed.

It's possible for an issue to belong to both a completed Sprint(s) and an incomplete Sprint(s). See also [closedSprints()][18].

| Syntax | `openSprints()` |
| --- | --- |
| Supported fields | Sprint |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= / IS , IS NOT, WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find all issues that are assigned to a sprint that has not yet been completed: sprint in openSprints() |

**[^ top of page][4]**

## outdated()

*Only applicable if Jira Service Management is installed and licensed.*

Returns issues whose SLAs are out of date because someone has changed the SLA in the settings. After the site reindexes and recalculates the SLAs, the function shouldn't return any issues. Use this function if a reindex is taking a long time or if you've deferred the reindex because you're making a lot of changes.

| Syntax | `outdated()` |
| --- | --- |
| Supported fields |  |
| Supported operators | `= , !=` |
| Unsupported operators | `~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues where SLAs are out of date: "Time to First Response" = outdated() |

**[^ top of page][4]**

## paused()

*Only applicable if Jira Service Management is installed and licensed.*

Returns issues that have an SLA that is paused due to a condition.

To find issues that are paused because they are outside calendar hours, use [withincalendarhours()][19].

| Syntax | `paused()` |
| --- | --- |
| Supported fields |  |
| Supported operators | `= , !=` |
| Unsupported operators | `~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues where Time to First Response is paused: "Time to First Response" = paused() |

**[^ top of page][4]**

## pending()

*Only applicable if Jira Service Management is installed and licensed.*

Search for issues that require approval.

| Syntax | `pending()` |
| --- | --- |
| Supported fields | Custom fields of type Approval |
| Supported operators | = |
| Unsupported operators | `~ , != , !~ ,` >, >=, <, <= / `IS , IS NOT , IN , NOT IN ,` `WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find all issues that require approval: approval = pending() |

**[^ top of page][4]**

## pendingBy()

*Only applicable if Jira Service Management is installed and licensed.*

Search for issues that require approval by one or more of the listed users. This uses an `OR` operator, and you must specify the username s.

| Syntax | `pendingBy(user1,user2)` |
| --- | --- |
| Supported fields | Custom fields of type Approval |
| Supported operators | = |
| Unsupported operators | `~ , != , !~ ,` >, >=, <, <= / `IS , IS NOT , IN , NOT IN ,` `WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that require approval by John Smith: approval = pendingBy(jsmith); Find issues that require by John Smith or Sarah Khan: approval = pendingBy(jsmith,skhan) |

**[^ top of page][4]**

## projectsLeadByUser()

Find issues in projects that are led by a specific user. You can optionally specify a user, or if the user is omitted, the current user will be used.

If you are not logged in to Jira, a user must be specified.

| Syntax | `projectsLeadByUser()` `projectsLeadByUser(username)` |
| --- | --- |
| Supported fields | Project |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= / IS , IS NOT, WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find open issues in projects that are led by you: project in projectsLeadByUser() AND status = Open; Find open issues in projects that are led by Bill: project in projectsLeadByUser(bill) AND status = Open |

**[^ top of page][4]**

## projectsWhereUserHasPermission()

Find issues in projects where you have a specific permission. Note, this function operates at the project level. This means that if a permission (e.g. "Edit Issues") is granted to the reporter of issues in a project, then you may see some issues returned where you are not the reporter, and therefore don't have the permission specified. Also note, this function is only available if you are logged in to Jira.

| Syntax | `projectsWhereUserHasPermission(permission)` For the `permission` parameter, you can specify any of the permissions described on. |
| --- | --- |
| Supported fields | Project |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= / IS , IS NOT, WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find open issues in projects where you have the "Resolve Issues" permission: project in projectsWhereUserHasPermission("Resolve Issues") AND status = Open |

**[^ top of page][4]**

## projectsWhereUserHasRole()

Find issues in projects where you have a specific role. Note, this function is only available if you are logged in to Jira.

| Syntax | `projectsWhereUserHasRole(rolename)` |
| --- | --- |
| Supported fields | Project |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= / IS , IS NOT, WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find open issues in projects where you have the "Developers" role: project in projectsWhereUserHasRole("Developers") AND status = Open |

**[^ top of page][4]**

## releasedVersions()

Perform searches based on the released versions (i.e. versions that your Jira administrator has released) of a specified project. You can also search on the released versions of all projects, by omitting the *project*  parameter. See also  [latestReleasedVersion][20] ().

| Syntax | `releasedVersions()` `releasedVersions(project)` |
| --- | --- |
| Supported fields | AffectedVersion, FixVersion, custom fields of type Version |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues whose FixVersion is a released version of the ABC project: fixVersion in releasedVersions(ABC); Find issues that relate to released versions of the ABC project: (affectedVersion in releasedVersions(ABC)) or (fixVersion in releasedVersions(ABC)) |

**[^ top of page][4]**

## remaining()

*Only applicable if Jira Service Management is installed and licensed.*

Returns issues whose clock is at a certain point relative to the goal.

| Syntax | `remaining()` |
| --- | --- |
| Supported fields |  |
| Supported operators | `= , !=, > , >= , < , <=` |
| Unsupported operators | `~ , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that will breach Time to Resolution in the next two hours: "Time to Resolution" < remaining("2h") |

**[^ top of page][4]**

## running()

*Only applicable if Jira Service Management is installed and licensed.*

Returns issues that have an SLA that is running, regardless of the calendar.

To find issues that are running based on calendar hours, use [withincalendarhours()][19].

| Syntax | `running()` |
| --- | --- |
| Supported fields |  |
| Supported operators | `= , !=` |
| Unsupported operators | `~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues where Time to First Response is running: "Time to First Response" = running() |

**[^ top of page][4]**

## standardIssueTypes()

Perform searches based on "standard" Issue Types, that is, search for issues that are not sub-tasks. See also [subtaskIssueTypes()][21].

| Syntax | `standardIssueTypes()` |
| --- | --- |
| Supported fields | Type |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that are not subtasks (i.e. issues whose Issue Type is a standard issue type, not a subtask issue type): issuetype in standardIssueTypes() |

**[^ top of page][4]**

## startOfDay()

Perform searches based on the start of the current day. See also [startOfWeek()][12], [startOfMonth()][13], [startOfYear()][14], [endOfDay()][15], [endOfWeek()][8], [endOfMonth()][9], and [endOfYear()][10].

| Syntax | `startOfDay()` `startOfDay("inc")` where `inc` is an optional increment of `(+/-)nn(y|M|w|d|h|m).` If the time unit qualifier is omitted, it defaults to the natural period of the function, e.g. startOfDay("+1") is the same as startOfDay("+1d"). If the plus/minus (+/-) sign is omitted, plus is assumed. |
| --- | --- |
| Supported fields | Created, Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ , IS , IS NOT , IN , NOT IN` |
| Examples | Find new issues created since the start of today: created > startOfDay(); Find new issues created since the start of yesterday: created > startOfDay("-1"); Find new issues created in the last three days: created > startOfDay("-3d") |

**[^ top of page][4]**

## startOfMonth()

Perform searches based on the start of the current month. See also [startOfDay()][11], [startOfWeek()][12], [startOfYear()][14], [endOfDay()][15], [endOfWeek()][8], [endOfMonth()][9], and [endOfYear()][10].

| Syntax | `startOfMonth()` `startOfMonth("inc")` where `inc` is an optional increment of `(+/-)nn(y|M|w|d|h|m).` If the time unit qualifier is omitted, it defaults to the natural period of the function, e.g. startOfMonth("+1") is the same as startOfMonth("+1M"). If the plus/minus (+/-) sign is omitted, plus is assumed. |
| --- | --- |
| Supported fields | Created, Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ , IS , IS NOT , IN , NOT IN` |
| Examples | Find new issues created since the start of this month: created > startOfMonth(); Find new issues created since the start of last month: created > startOfMonth("-1"); Find new issues created since the 15th of this month: created > startOfMonth("+14d") |

**[^ top of page][4]**

## startOfWeek()

Perform searches based on the start of the current week. See also [startOfDay()][11], [startOfMonth()][13], [startOfYear()][14], [endOfDay()][15], [endOfWeek()][8], [endOfMonth()][9], and [endOfYear()][10].

For the startOfWeek() function, the result depends upon your locale. For example, in Europe, the first day of the week is generally considered to be Monday, while in the USA, it is considered to be Sunday.

| Syntax | `startOfWeek()` `startOfWeek("inc")` where `inc` is an optional increment of `(+/-)nn(y|M|w|d|h|m).` If the time unit qualifier is omitted, it defaults to the natural period of the function, e.g. startOfWeek("+1") is the same as startOfWeek("+1w"). If the plus/minus (+/-) sign is omitted, plus is assumed. |
| --- | --- |
| Supported fields | Created, Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ , IS , IS NOT , IN , NOT IN` |
| Examples | Find new issues since the start of this week: created > startOfWeek(); Find new issues since the start of last week: created > startOfWeek("-1") |

**[^ top of page][4]**

## startOfYear()

Perform searches based on the start of the current year. See also [startOfDay()][11], [startOfWeek()][12], [startOfMonth()][13], [endOfDay()][15], [endOfWeek()][8], [endOfMonth()][9], and [endOfYear][10].

| Syntax | `startOfYear()` `startOfYear("inc")` where `inc` is an optional increment of `(+/-)nn(y|M|w|d|h|m).` If the time unit qualifier is omitted, it defaults to the natural period of the function, e.g. endOfYear("+1") is the same as endOfYear("+1y"). If the plus/minus (+/-) sign is omitted, plus is assumed. |
| --- | --- |
| Supported fields | Created, Due, Resolved, Updated, custom fields of type Date/Time |
| Supported operators | `= , != , > , >= , < , <=` / `WAS* , WAS IN* , WAS NOT* , WAS NOT IN* , CHANGED*` `*` `Only in predicate` |
| Unsupported operators | `~ , !~ , IS , IS NOT , IN , NOT IN` |
| Examples | Find new issues since the start of this year: created > startOfYear(); Find new issues since the start of last year: created > startOfYear("-1") |

**[^ top of page][4]**

## subtaskIssueTypes()

Perform searches based on issues that are sub-tasks. See also [standardIssueTypes()][22].

| Syntax | `subtaskIssueTypes()` |
| --- | --- |
| Supported fields | Type |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that are subtasks (i.e. issues whose Issue Type is a subtask issue type): issuetype in subtaskIssueTypes() |

**[^ top of page][4]**

## unreleasedVersions()

Perform searches based on the unreleased versions (i.e. versions that your Jira administrator has not yet released) of a specified project. You can also search on the unreleased versions of all projects, by omitting the `project`  parameter. See also  [earliestUnreleasedVersion()][23].

| Syntax | `unreleasedVersions()` `unreleasedVersions(project)` |
| --- | --- |
| Supported fields | AffectedVersion, FixVersion, custom fields of type Version |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <=` `, IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues whose FixVersion is an unreleased version of the ABC project: fixVersion in unreleasedVersions(ABC); Find issues that relate to unreleased versions of the ABC project: affectedVersion in unreleasedVersions(ABC) |

**[^ top of page][4]**

## updatedBy()

Search for issues that were updated by a specific user, optionally within the specified time range. An update in this case includes creating an issue, updating any of the issue's fields, creating or deleting a comment, or editing a comment (only the last edit).

For the time range, use one of the following formats:

`"yyyy/MM/dd"`  
`"yyyy-MM-dd"`

Or use `"w"` (weeks), or `"d"` (days) to specify a date relative to the current time. Unlike some other functions, `updatedBy` doesn't support values smaller then a day, and will always round them up to 1 day.

| Syntax | `updatedBy(user)` `updatedBy(user, dateFrom)` `updatedBy(user, dateFrom, dateTo)` |
| --- | --- |
| Supported fields | `Issuekey` , and its aliases ( `id` , `issue` , `key` ) |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `=, ~ , != , !~ , > , >= , < , <= / IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that were updated by John Smith: issuekey IN updatedBy(jsmith); Find issues that were updated by John Smith within the last 8 days: issuekey IN updatedBy(jsmith, "-8d"); Find issues updated between June and September 2018: issuekey IN updatedBy(jsmith, "2018/06/01", "2018/08/31" ); If you try to find issues updated in the last hour, like in the following example, the time will be rounded up to 1 day, as smaller values aren't supported: issuekey IN updatedBy(jsmith, "-1h") |

**[^ top of page][4]**

## votedIssues()

Perform searches based on issues for which you have voted. Also, see the [Voter][24] field.

This function can only be used by logged-in users.

| Syntax | `votedIssues()` |
| --- | --- |
| Supported fields | Issue |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <=` `, IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that you have voted for: issue in votedIssues() |

**[^ top of page][4]**

## watchedIssues()

Perform searches based on issues that you are watching. Also, see the [Watcher][25] field.

This function can only be used by logged-in users.

| Syntax | `watchedIssues()` |
| --- | --- |
| Supported fields | Issue |
| Supported operators | `IN , NOT IN` |
| Unsupported operators | `= , != , ~ , !~ , > , >= , < , <=` `, IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues that you are watching: issue in watchedIssues() |

**[^ top of page][4]**

## withinCalendarHours()

*Only applicable if Jira Service Management is installed and licensed.*

Returns issues that have an SLA that is running according to the calendar.

For example, say your project has two SLAs that count Time to First Response. Some issues with this use a 9am-1pm calendar, and others use a 9am-5pm calendar. If an agent starts work at 3pm, they probably want to work on issues from the 9am-5pm agreement first. They can use withincalendarhours() to find all the issues where Time to First Response is running at 3pm.

| Syntax | `withinCalendarHours()` |
| --- | --- |
| Supported fields |  |
| Supported operators | `= , !=` |
| Unsupported operators | `~ , !~ , > , >= , < , <= , IS , IS NOT , WAS , WAS IN , WAS NOT , WAS NOT IN , CHANGED` |
| Examples | Find issues where Time to First Response is within calendar hours: "Time to First Response" = withinCalendarHours() |

**[^ top of page][4]**

Last modified on Oct 12, 2023

Was this helpful?

Yes

Powered by [Confluence][26] and [Scroll Viewport][27].

[1]: https://confluence.atlassian.com/adminjiraserver/managing-system-fields-1047552725.html
[2]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html
[3]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-fields-reference-1488596774.html
[4]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-top
[5]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-openSprints
[6]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-lastLogin
[7]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-unreleasedVersions
[8]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-endOfWeek
[9]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-endOfMonth
[10]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-endOfYear
[11]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-startOfDay
[12]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-startOfWeek
[13]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-startOfMonth
[14]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-startOfYear
[15]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-endOfDay
[16]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-currentLogin
[17]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-releasedVersions
[18]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-closedSprints
[19]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-withincalendarhours
[20]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-latestReleasedVersion
[21]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-subtaskIssueTypes
[22]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-standardIssueTypes
[23]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfunctionsreference-earliestUnreleasedVersion
[24]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-fields-reference-1488596774.html#Advancedsearchingfieldsreference-voter
[25]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-fields-reference-1488596774.html#Advancedsearchingfieldsreference-watcher
[26]: http://www.atlassian.com/
[27]: https://www.k15t.com/go/scroll-viewport
