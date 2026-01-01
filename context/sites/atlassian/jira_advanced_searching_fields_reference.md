---
title: "Advanced searching - fields reference | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-fields-reference-1488596774.html"
author:
  - "[[Work log author🔗]]"
  - "[[🔗]]"
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
Partial conversion completed with errors. Original HTML:

This page describes information about fields that are used for advanced searching. A field in JQL is a word that represents a Jira field (or a custom field that has already been defined in your Jira applications). In a clause, a field is followed by an [operator][1], which in turn is followed by one or more values (or  [functions][2]). The operator compares the value of the field with one or more values or functions on the right, such that only true results are retrieved by the clause. Note: it is not possible to compare two fields in JQL.

## Affected version

 Search for issues that are assigned to a particular affects version(s). You can search by version name or version ID (i.e. the number that Jira automatically allocates to a version).Note, it is better to search by version ID than by version name. Different projects may have versions with the same name. It is also possible for your Jira administrator to change the name of a version, which could break any saved filters that rely on that name. Version IDs, however, are unique and cannot be changed.

| Syntax | `affectedVersion` |
| --- | --- |
| Field Type | VERSION |
| Auto-complete | Yes |
| Supported operators | `= , != , > , >= , < , <= , ~ , !~` / `IS, IS NOT, IN, NOT IN` The comparison operators (e.g. ">") use the version order that has been set up by your project administrator, not a numeric or alphabetic order.; For this field, the contain operators (~ and!~) find exact matches, and can be used to search through versions with a wildcard. |
| Unsupported operators | `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | When used with the IN and NOT IN operators, this field supports: releasedVersions (); latestReleasedVersion (); unreleasedVersions (); earliestUnreleasedVersion () |
| Examples | Find issues with an AffectedVersion of 3.14: affectedVersion = "3.14" Note that full-stops are reserved characters and need to be surrounded by quote-marks.; Find issues with an AffectedVersion of "Big Ted": affectedVersion = "Big Ted"; Find issues with an AffectedVersion ID of 10350: affectedVersion = 10350 |

 **[^ top of page][3]**

 ## Approvals

 *Only applicable if Jira Service Management is installed and licensed, and you're using the Approvals functionality.*

Search for issues that have been approved or require approval. This can be further refined by user.

| Syntax | `approvals` |
| --- | --- |
| Field Type | USER |
| Auto-complete | No |
| Supported operators | `=` |
| Unsupported operators | `~ , != , !~ , > , >= , < , <= / IS , IS NOT , IN , NOT IN , WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | approved(); approver(); myApproval(); myPending(); pending(); pendingBy() |
| Examples | Find issues that require or required approval by John Smith: approval = approver(jsmith); Find issues that require approval by John Smith: approval = pendingBy(jsmith); Find issues that require approval by the current user: approval = myPending(); Find all issues that require approval: approval = pending() |

 **[^ top of page][3]**

 ## Assignee

 Search for issues that are assigned to a particular user. You can search by the user's full name, ID, or email address.

| Syntax | `assignee` |
| --- | --- |
| Alias | `cf[CustomFieldID]` |
| Field Type | USER |
| Auto-complete | Yes |
| Supported operators | `= , !=` / `IS, IS NOT, IN, NOT IN, WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` Note that the comparison operators (e.g. ">") use the version order that has been set up by your project administrator, not a numeric or alphabetic order. |
| Unsupported operators | `~ , !~ , > , >= , < , <=` |
| Supported functions | When used with the IN and NOT IN operators, this field supports: membersOf() When used with the EQUALS and NOT EQUALS operators, this field supports: currentUser() |
| Examples | Find issues that are assigned to John Smith: assignee = "John Smith" or assignee = jsmith; Find issues that are currently assigned, or were previously assigned, to John Smith: assignee WAS "John Smith" or assignee WAS jsmith; Find issues that are assigned by the user with email address "bob@mycompany.com": assignee = "bob@mycompany.com" Note that full-stops and "@" symbols are reserved characters and need to be surrounded by quote-marks. |

**[^ top of page][3]**

 ## Attachments

 Search for issues that have or do not have attachments. 

| Syntax | `attachments` |
| --- | --- |
| Field Type | ATTACHMENT |
| Auto-complete | Yes |
| Supported operators | `IS, IS NOT` |
| Unsupported operators | `=, != , ~ , !~ , > , >= , < , <=` `IN, NOT IN, WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | None |
| Examples | Search for issues that have attachments: attachments IS NOT EMPTY; Search for issues that do not have attachments: attachments IS EMPTY |

 **[^ top of page][3]**

 ## Category

 Search for issues that belong to projects in a particular category.

| Syntax | `category` |
| --- | --- |
| Field Type | CATEGORY |
| Auto-complete | Yes |
| Supported operators | `=, !=` / `IS, IS NOT, IN, NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | None |
| Examples | Find issues that belong to projects in the "Alphabet Projects" Category: category = "Alphabet Projects" |

 **[^ top of page][3]**

 Search for issues that have a comment that contains particular text. [Jira text-search syntax][4] can be used.

| Syntax | `comment` |
| --- | --- |
| Field Type | TEXT |
| Auto-complete | No |
| Supported operators | `~ , !~` |
| Unsupported operators | `= , != , > , >= , < , <= / IS, IS NOT, IN, NOT IN,` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | None |
| Examples | Find issues where a comment contains text that matches "My PC is quite old" (i.e. a "fuzzy" match: comment ~ "My PC is quite old"; Find issues where a comment contains the exact phrase "My PC is quite old": comment ~ "\"My PC is quite old\"" |

 **[^ top of page][3]**

 ## Component

 Search for issues that belong to a particular component(s) of a project. You can search by component name or component ID (i.e. the number that Jira automatically allocates to a component).

Note, it is safer to *search by component ID than by component name*. Different projects may have components with the same name, so searching by component name may return issues from multiple projects. It is also possible for your Jira administrator to change the name of a component, which could break any saved filters that rely on that name. Component IDs, however, are unique and cannot be changed.

| Syntax | `component` |
| --- | --- |
| Field Type | COMPONENT |
| Auto-complete | Yes |
| Supported operators | `= , != / IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | When used with the IN and NOT IN operators, component supports: componentsLeadByUser() |
| Examples | Find issues in the "Comp1" or "Comp2" component: component in (Comp1, Comp2); Find issues in the "Comp1" and"Comp2" components: component in (Comp1) and component in (Comp2) or component = Comp1 and component = Comp2; Find issues in the component with ID 20500: component = 20500 |

 **[^ top of page][3]**

 ## Created

 Search for issues that were created on, before, or after a particular date (or date range). Note that if a time-component is not specified, midnight will be assumed. Please note that the search results will be relative to your configured time zone (which is by default the Jira instance's time zone).

Use one of the following formats:

`"yyyy/MM/dd HH:mm"` 
 `"yyyy-MM-dd HH:mm"` 
 `"yyyy/MM/dd"` 
 `"yyyy-MM-dd"`

 Or use `"w"` (weeks), `"d"` (days), `"h"` (hours) or `"m"` (minutes) to specify a date relative to the current time. The default is `"m"` (minutes). Be sure to use quote-marks (`"`); if you omit the quote-marks, the number you supply will be interpreted as milliseconds after epoch (1970-1-1).

| Syntax | `created` |
| --- | --- |
| Alias | `createdDate` |
| Field Type | DATE |
| Auto-complete | No |
| Supported operators | `= , != , > , >= , < , <= / IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | When used with the EQUALS , NOT EQUALS , GREATER THAN , GREATER THAN EQUALS , LESS THAN or LESS THAN EQUALS operators, this field supports: currentLogin(); lastLogin(); now(); startOfDay(); startOfWeek(); startOfMonth(); startOfYear(); endOfDay(); endOfWeek(); endOfMonth(); endOfYear() |
| Examples | Find all issues created before 12th December 2010: created < "2010/12/12"; Find all issues created on or before 12th December 2010: created <= "2010/12/13"; Find all issues created on 12th December 2010 before 2:00pm: created > "2010/12/12" and created < "2010/12/12 14:00"; Find issues created less than one day ago: created > "-1d"; Find issues created in January 2011: created > "2011/01/01" and created < "2011/02/01"; Find issues created on 15 January 2011: created > "2011/01/15" and created < "2011/01/16" |

 **[^ top of page][3]**

 ## Creator

 Search for issues that were created by a particular user. You can search by the user's full name, ID, or email address.

| Syntax | `creator` |
| --- | --- |
| Field Type | USER |
| Auto-complete | Yes |
| Supported operators | `= , != / IS , IS NOT , IN , NOT IN, WAS, WAS IN, WAS NOT, WAS NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `CHANGED` |
| Supported functions | When used with the IN and NOT IN operators, this field supports: membersOf () When used with the EQUALS and NOT EQUALS operators, this field supports: currentUser () |
| Examples | Search for issues that were created by Jill Jones: creator = "Jill Jones" or creator = "jjones"; Search for issues that were created by the user with email address "bob@mycompany.com": creator = "bob@mycompany.com" (Note that full-stops and "@" symbols are reserved characters , so the email address needs to be surrounded by quote-marks.) |

 **[^ top of page][3]**

 ## Custom field

 *Only applicable if your Jira administrator has created one or more custom fields.*

Search for issues where a particular custom field has a particular value. You can search by custom field name or custom field ID (i.e. the number that Jira automatically allocates to an custom field).

Note, it is safer to search by custom field ID than by custom field name. It is possible for a custom field to have the same name as a built-in Jira system field; in which case, Jira will search for the system field (not your custom field). It is also possible for your Jira administrator to change the name of a custom field, which could break any saved filters that rely on that name. Custom field IDs, however, are unique and cannot be changed.

| Syntax | `CustomFieldName` |
| --- | --- |
| Alias | `cf[CustomFieldID]` |
| Field Type | Depends on the custom field's configuration / Note, Jira text-search syntax can be used with custom fields of type 'Text'. |
| Auto-complete | Yes, for custom fields of type picker, group picker, select, checkbox and radio button fields |
| Supported operators | Different types of custom field support different operators. |
| Supported operators: / number and date fields | `= , != , > , >= , < . <= / IS , IS NOT , IN , NOT IN` |
| Unsupported operators: / number and date fields | `~ , !~` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported operators: / picker, select, checkbox / and radio button fields | `= , != / IS , IS NOT , IN , NOT IN` |
| Unsupported operators: / picker, select, checkbox / and radio button fields | `~ , !~ , > , >= , < . <=` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported operators: / text fields | `~ , !~ / IS , IS NOT` |
| Unsupported operators: / text fields | `= , != , > , >= , < . <=` `IN , NOT IN , WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | Different types of custom fields support different functions. |
| Supported functions: / date/time fields | When used with the EQUALS , NOT EQUALS , GREATER THAN , GREATER THAN EQUALS , / LESS THAN or LESS THAN EQUALS operators, this field supports: currentLogin (); lastLogin (); now (); startOfDay (); startOfWeek (); startOfMonth (); startOfYear (); endOfDay (); endOfWeek (); endOfMonth (); endOfYear () |
| Supported functions: / version picker fields | Version picker fields: When used with the IN and NOT IN operators, this field supports: releasedVersions (); latestReleasedVersion (); unreleasedVersions (); earliestUnreleasedVersion () |
| Examples | Find issues where the value of the "Location" custom field is "New York": location = "New York"; Find issues where the value of the custom field with ID 10003 is "New York": cf[ 10003 ] = "New York"; Find issues where the value of the "Location" custom field is "London" or "Milan" or "Paris": cf[ 10003 ] in ( "London" , "Milan" , "Paris" ); Find issues where the "Location" custom field has no value: location != empty |

 **[^ top of page][3]**

 ## Customer Request Type

 *Only applicable if Jira Service Management is installed and licensed.*

Search for Issues matching a specific Customer Request Type in a service desk project. You can search for a Customer Request Type either by name or description as configured in the Request Type configuration screen. 

| Syntax | `"Customer Request Type"` |
| --- | --- |
| Field Type | Custom field |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `IS , IS NOT, WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` Note that the Lucene value for Customer Request Type, is `portal-key/request-type-key` . While the portal key cannot be changed after a service desk portal is created, the project key can be changed. The Request Type key cannot be changed once the Request Type is created. |
| Supported functions | None |
| Examples | Find issues where Customer Request Type is Request a new account in projects that the user has access to: "Customer Request Type" = "Request a new account"; Find issues where the Customer Request Type is Request a new account in SimpleDesk project , where the right operand is a selected Lucene value from the auto-complete suggestion list. "Customer Request Type" = "sd/system-access"; Find issues where Customer Request Type is either Request a new account or Get IT Help . "Customer Request Type" IN ( "Request a new account", "Get IT Help") |

 **[^ top of page][3]**

 ## Description

 Search for issues where the description contains particular text. [Jira text-search syntax][4] can be used.

| Syntax | `description` |
| --- | --- |
| Field Type | TEXT |
| Auto-complete | No |
| Supported operators | `~ , !~ / IS , IS NOT` |
| Unsupported operators | `= , != , > , >= , < , <=` `IN , NOT IN, WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues where the description contains text that matches "Please see screenshot" (i.e. a "fuzzy" match): description ~ "Please see screenshot"; Find issues where the description contains the exact phrase "Please see screenshot": description ~ "\"Please see screenshot\"" |

 **[^ top of page][3]**

 ## Due

 Search for issues that were due on, before, or after a particular date (or date range). Note that the due date relates to the *date* only (not to the time).

Use one of the following formats:

`"yyyy/MM/dd"` 
 `"yyyy-MM-dd"`

 Or use `"w"` (weeks) or `"d"` (days) to specify a date relative to the current date. Be sure to use quote-marks (`"`).

| Syntax | `due` |
| --- | --- |
| Alias | `dueDate` |
| Field Type | DATE |
| Auto-complete | No |
| Supported operators | `= , != , > , >= , < , <= / IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~` `WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the EQUALS, NOT EQUALS, GREATER THAN, GREATER THAN EQUALS , / LESS THAN or LESS THAN EQUALS operators, this field supports: currentLogin (); lastLogin (); now (); startOfDay (); startOfWeek (); startOfMonth (); startOfYear (); endOfDay (); endOfWeek (); endOfMonth (); endOfYear () |
| Examples | Find all issues due before 31st December 2010: due < "2010/12/31"; Find all issues due on or before 31st December 2010: due <= "2011/01/01"; Find all issues due tomorrow: due = "1d"; Find all issues due in January 2011: due >= "2011/01/01" and due <= "2011/01/31"; Find all issues due on 15 January 2011: due = "2011/01/15" |

 **[^ top of page][3]**

 ## Environment

 Search for issues where the environment contains particular text. [Jira text-search syntax][4] can be used.

| Syntax | `environment` |
| --- | --- |
| Field Type | TEXT |
| Auto-complete | No |
| Supported operators | `~ , !~` `IS , IS NOT` |
| Unsupported operators | `= , != , > , >= , < , <=` `IN , NOT IN, WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues where the environment contains text that matches "Third floor" (i.e. a "fuzzy" match): environment ~ "Third floor"; Find issues where the environment contains the exact phrase "Third floor": environment ~ "\"Third floor\"" |

 **[^ top of page][3]**

 ## Epic link

 Search for issues that belong to a particular epic. The search is based on either the epic's name, issue key, or issue ID (i.e. the number that Jira automatically allocates to an issue).

| Syntax | `"epic link"` |
| --- | --- |
| Field Type | Epic Link Relationship |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT, IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the IN or NOT IN operators, `epic link` supports: issueHistory (); linkedIssues (); votedIssues (); watchedIssues () |
| Examples | Find issues that belong to epic "Jupiter", where "Jupiter has the issue key ANERDS-31: "epic link" = ANERDS- 31 or "epic link" = Jupiter |

 **[^ top of page][3]**

 ## Filter

 You can use a saved filter to narrow your search. You can search by filter name or filter ID (i.e. the number that Jira automatically allocates to a saved filter).

Note:

- It is safer to search by filter ID than by filter name. It is possible for a filter name to be changed, which could break a saved filter that invokes another filter by name. Filter IDs, however, are unique and cannot be changed.
- An unnamed link statement in your typed query will override an ORDER BY statement in the saved filter.
- You cannot run or save a filter that would cause an infinite loop (i.e. you cannot reference a saved filter if it eventually references your current filter).

| Syntax | `filter` |
| --- | --- |
| Aliases | `request , savedFilter , searchRequest` |
| Field Type | Filter |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `IS , IS NOT, WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Search the results of the filter "My Saved Filter" (which has an ID of 12000) for issues assigned to the user jsmith: filter = "My Saved Filter" and assignee = jsmith or filter = 12000 and assignee = jsmith |

 **[^ top of page][3]**

 ## Fix version

 Search for issues that are assigned to a particular fix version. You can search by version name or version ID (i.e. the number that Jira automatically allocates to a version).

Note, it is safer to search by version ID than by version name. Different projects may have versions with the same name, so searching by version name may return issues from multiple projects. It is also possible for your Jira administrator to change the name of a version, which could break any saved filters that rely on that name. Version IDs, however, are unique and cannot be changed.

| Syntax | `fixVersion` |
| --- | --- |
| Field Type | VERSION |
| Auto-complete | Yes |
| Supported operators | `= , != , > , >= , < , <= , ~ , !~` `IS , IS NOT, IN , NOT IN, WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` The comparison operators (e.g. ">") use the version order that has been set up by your project administrator, not a numeric or alphabetic order.; For this field, the contain operators (~ and!~) find exact matches, and can be used to search through versions with a wildcard. |
| Unsupported operators |  |
| Supported functions | When used with the IN and NOT IN operators, this field supports: releasedVersions (); latestReleasedVersion (); unreleasedVersions (); earliestUnreleasedVersion () |
| Examples | Find issues with a Fix Version of 3.14 or 4.2: fixVersion in ( "3.14" , "4.2" ) (Note that full-stops are reserved characters , so they need to be surrounded by quote-marks.); Find issues with a Fix Version of "Little Ted": fixVersion = "Little Ted"; Find issues with a Fix Version ID of 10001: fixVersion = 10001 |

 **[^ top of page][3]**

 ## Issue key

 Search for issues with a particular issue key or issue ID (i.e. the number that Jira automatically allocates to an issue).

| Syntax | `issueKey` |
| --- | --- |
| Aliases | `id , issue , key` |
| Field Type | ISSUE |
| Auto-complete | No |
| Supported operators | `= , != , > , >= , < , <=` `IS , IS NOT, IN , NOT IN` |
| Unsupported operators | `~ , !~ / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the IN or NOT IN operators, `issueKey` supports: issueHistory (); linkedIssues (); updatedBy (); votedIssues (); watchedIssues () |
| Examples | Find the issue with the key "ABC-123": issueKey = ABC- 123; Find several issues with the known keys "SCRUM-25" and "SCRUM-12" issuekey in (SCRUM-25, SCRUM-12) |

 **[^ top of page][3]**

 ## Issue link type

 Issue linking allows you to create associations between issues on either the same or different Jira instances. For example, an issue may *duplicate* another issue or *depend* on the resolution of another issue.You can find detailed information about issue links in [Configuring issue linking][5]. 

When searching for issues with a particular link type, you can only find linked issues that are on the same Jira instance you're searching on. Links to issues on a remote Jira instance or to Confluence pages won't be included.

Use the following JQL query to add colors to your issue cards! For example, add a red stripe to issues that have some blockers, and keep all other issues green. This will help you bring the right information to your team’s attention, at a glance. For more info, see [Customizing cards][6].

| Syntax | `issueLinkType` |
| --- | --- |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <= / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED , IS , IS NOT` |
| Supported functions | None |
| Examples | Find issues with a link type of "blocks": issueLinkType = blocks; Find issues with an issue type of "duplicates" or "is duplicated by": issueLinkType in (duplicates,"is duplicated by"); Find issues with link types other than “clones”: issueLinkType != clones This query will also return issues with no links at all.; Find issues that are blocker by other issues, or that don't have any blockers. issueLinkType = "is blocked by" issueLinkType != "is blocked by" |

 **[^ top of page][3]**

 Search for issues tagged with a label or list of labels. You can also search for issues without any labels to easily identify which issues need to be tagged so they show up in the relevant sprints, queues or reports. 

| Syntax | `labels` |
| --- | --- |
| Field Type | LABEL |
| Auto-complete | Yes |
| Supported operators | `= , !=,` `IS, IS NOT, IN, NOT IN` We recommend using IS or IS NOT to search for a single label, and IN or NOT IN to search for a list of labels. |
| Unsupported operators | `~ , !~ , , > , >= , < , <=` / `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | None |
| Examples | Find issues with an existing label: labels = "x"; Find issues without a specified label, including issues without a label: labels not in ("x") or labels is EMPTY |

 ## Last viewed

 Search for issues that were last viewed on, before, or after a particular date (or date range). Note that if a time-component is not specified, midnight will be assumed. Please note that the search results will be relative to your configured time zone (which is by default the Jira instance's time zone).

Use one of the following formats:

`"yyyy/MM/dd HH:mm"` 
 `"yyyy-MM-dd HH:mm"` 
 `"yyyy/MM/dd"` 
 `"yyyy-MM-dd"`

 Or use `"w"` (weeks), `"d"` (days), `"h"` (hours) or `"m"` (minutes) to specify a date relative to the current time. The default is `"m"` (minutes). Be sure to use quote-marks (`"`); if you omit the quote-marks, the number you supply will be interpreted as milliseconds after epoch (1970-1-1).

| Syntax | `lastViewed` |
| --- | --- |
| Field Type | DATE |
| Auto-complete | No |
| Supported operators | `= , != , > , >= , < , <=` `IS , IS NOT, IN , NOT IN` |
| Unsupported operators | `~ , !~ / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the EQUALS , NOT EQUALS , GREATER THAN , GREATER THAN EQUALS , LESS THAN or LESS THAN EQUALS operators, this field supports: currentLogin (); lastLogin (); now (); startOfDay (); startOfWeek (); startOfMonth (); startOfYear (); endOfDay (); endOfWeek (); endOfMonth (); endOfYear () |
| Examples | Find all issues last viewed before 12th December 2010: lastViewed < "2010/12/12"; Find all issues last viewed on or before 12th December 2010: lastViewed <= "2010/12/13"; Find all issues last viewed on 12th December 2010 before 2:00pm: lastViewed > "2010/12/12" and created < "2010/12/12 14:00"; Find issues last viewed less than one day ago: lastViewed > "-1d"; Find issues last viewed in January 2011: lastViewed > "2011/01/01" and created < "2011/02/01"; Find issues last viewed on 15 January 2011: lastViewed > "2011/01/15" and created < "2011/01/16" |

 **[^ top of page][3]**

 ## Level

 *Only available if issue level security has been enabled by your Jira administrator.*

Search for issues with a particular security level. You can search by issue level security name or issue level security ID (i.e. the number that Jira automatically allocates to an issue level security).

Note, it is safer to search by security level ID than by security level name. It is possible for your Jira administrator to change the name of a security level, which could break any saved filter that rely on that name. Security level IDs, however, are unique and cannot be changed.

| Syntax | `level` |
| --- | --- |
| Field Type | SECURITY LEVEL |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT, IN , NOT IN` |
| Unsupported operators | `> , >= , < , <= ,` `~ , !~ / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Search for issues with a security level of "Really High" or "level1": level in ( "Really High" , level1); Search for issues with a security level ID of 123: level = 123 |

 **[^ top of page][3]**

 ## Original estimate

 *Only available if time-tracking has been enabled by your Jira administrator.*

Search for issues where the original estimate is set to a particular value (i.e. a number, not a date or date range). Use "w", "d", "h" and "m" to specify weeks, days, hours, or minutes.

| Syntax | `originalEstimate` |
| --- | --- |
| Alias | `timeOriginalEstimate` |
| Field Type | DURATION |
| Auto-complete | No |
| Supported operators | `= , != , > , >= , < , <=` `IS , IS NOT, IN , NOT IN` |
| Unsupported operators | `~ , !~ / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues with an original estimate of 1 hour: originalEstimate = 1h; Find issues with an original estimate of more than 2 days: originalEstimate > 2d |

 **[^ top of page][3]**

 ## Parent

 *Only available if sub-tasks have been enabled by your Jira administrator.*

Search for all sub-tasks of a particular issue. You can search by issue key or by issue ID (i.e. the number that Jira automatically allocates to an Issue).

| Syntax | `parent` |
| --- | --- |
| Field Type | ISSUE |
| Auto-complete | No |
| Supported operators | `= , !=` `IN , NOT IN` |
| Unsupported operators | `> , >= , < , <= ,` `~ , !~ / IS , IS NOT, WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues that are sub-tasks of issue TEST-1234: parent = TEST- 1234 |

 **[^ top of page][3]**

 ## Priority

 Search for issues with a particular priority. You can search by priority name or priority ID (i.e. the number that Jira automatically allocates to a priority).

Note, it is safer to search by priority ID than by priority name. It is possible for your Jira administrator to change the name of a priority, which could break any saved filter that rely on that name. Priority IDs, however, are unique and cannot be changed.

| Syntax | `priority` |
| --- | --- |
| Field Type | PRIORITY |
| Auto-complete | Yes |
| Supported operators | `= , != , > , >= , < , <=` `IS , IS NOT,` `IN , NOT IN , WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Unsupported operators | `~ , !~` |
| Supported functions | None |
| Examples | Find issues with a priority of "High": priority = High; Find issues with a priority ID of 10000: priority = 10000 |

 **[^ top of page][3]**

 ## Project

 Search for issues that belong to a particular project. You can search by project name, by project key or by project ID (i.e. the number that Jira automatically allocates to a project). In the rare case where there is a project whose project key is the same as another project's name, then the project key takes preference and hides results from the second project.

| Syntax | `project` |
| --- | --- |
| Field Type | PROJECT |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT, IN , NOT IN` |
| Unsupported operators | `> , >= , < , <= ,` `~ , !~ / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the IN and NOT IN operators, `project` supports: projectsLeadByUser (); projectsWhereUserHasPermission (); projectsWhereUserHasRole () |
| Examples | Find issues that belong to the Project that has the name "ABC Project": project = "ABC Project"; Find issues that belong to the project that has the key "ABC": project = "ABC"; Find issues that belong to the project that has the ID "1234": project = 1234 |

 **[^ top of page][3]**

 ## Remaining estimate

 *Only available if time-tracking has been enabled by your Jira administrator.*

Search for issues where the remaining estimate is set to a particular value (i.e. a number, not a date or date range). Use "w", "d", "h" and "m" to specify weeks, days, hours, or minutes.

| Syntax | `remainingEstimate` |
| --- | --- |
| Alias | `timeEstimate` |
| Field Type | DURATION |
| Auto-complete | No |
| Supported operators | `= , != ,` `> , >= , < , <=` `IS , IS NOT, IN , NOT IN` |
| Unsupported operators | `~ , !~ / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues with a remaining estimate of more than 4 hours: remainingEstimate > 4h |

 **[^ top of page][3]**

 ## Reporter

 Search for issues that were reported by a particular user. This may be the same as the creator, but can be distinct. You can search by the user's full name, ID, or email address.

| Syntax | `reporter` |
| --- | --- |
| Field Type | USER |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT, IN , NOT IN ,` `WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Unsupported operators | `~ , !~ ,` `> , >= , < , <=` |
| Supported functions | When used with the IN and NOT IN operators, this field supports: membersOf () When used with the EQUALS and NOT EQUALS operators, this field supports: currentUser () |
| Examples | Search for issues that were reported by Jill Jones: reporter = "Jill Jones" or reporter = jjones; Search for issues that were reported by the user with email address " bob@mycompany.com ": reporter = "bob@mycompany.com" (Note that full-stops and "@" symbols are reserved characters , so the email address needs to be surrounded by quote-marks.) |

 **[^ top of page][3]**

 ## Request channel type

 *Only applicable if Jira Service Management is installed and licensed.*

Search for issues that were requested through a specific channel (e.g. issues submitted via email or through a Service Desk portal).

| Syntax | `request-channel-type` |
| --- | --- |
| Field Type | TEXT |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS, IS NOT, IN, NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | When used with the IN and NOT IN operators, this field supports: email : requests submitted via email; Jira : requests created using Jira; portal : requests created using a Service Desk portal; api : requests created using a REST API |
| Examples | Find issues where the request channel was email: request-channel-type = email; Find issues where the request channel was something other than a service desk portal: request-channel-type != portal |

 **[^ top of page][3]**

 ## Request last activity time

 *Only applicable if Jira Service Management is installed and licensed.*

Search for issues that  were last acted  on or created:

- on a particular date.
- before/after a particular date (or date range).

Note that if a time-component is not specified, midnight will be assumed. Please note that the search results will be relative to your configured time zone (which is by default the Jira instance's time zone).

Use one of the following formats:

`"yyyy/MM/dd HH:mm"` 
 `"yyyy-MM-dd HH:mm"` 
 `"yyyy/MM/dd"` 
 `"yyyy-MM-dd"`

 Or use `"w"` (weeks), `"d"` (days), `"h"` (hours) or `"m"` (minutes) to specify a date relative to the current time. The default is `"m"` (minutes). Be sure to use quote-marks (`"`); if you omit the quote-marks, the number you supply will be interpreted as milliseconds after epoch (1970-1-1).

| Syntax | `request-last-activity-time` |
| --- | --- |
| Field Type | DATE |
| Auto-complete | Yes |
| Supported operators | `= , != , > , >= , < , <=` `IS, IS NOT, IN, NOT IN` |
| Unsupported operators | `~ , !~` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | When used with the EQUALS, NOT EQUALS, GREATER THAN, GREATER THAN EQUALS , / LESS THAN or LESS THAN EQUALS operators, this field supports: currentLogin (); lastLogin (); now (); startOfDay (); startOfWeek (); startOfMonth (); startOfYear (); endOfDay (); endOfWeek (); endOfMonth (); endOfYear () |
| Examples | Find all issues last acted on before 23rd May 2016: request-last-activity-time < "2016/05/23" Find all issues last acted on or before 23rd May 2016: request-last-activity-time <= "2016/05/23" Find all issues created on 23rd May 2016 and last acted on before 2:00pm that day: created > "2016/05/23" AND request-last-activity-time < "2016/05/23 14:00" Find issues last acted on less than one day ago: request-last-activity-time > "-1d" Find issues last acted on in January 2016: request-last-activity-time > "2016/01/01" and request-last-activity-time < "2016/02/01"; Find all issues last acted on before 23rd May 2016: request-last-activity-time < "2016/05/23"; Find all issues last acted on or before 23rd May 2016: request-last-activity-time <= "2016/05/23"; Find all issues created on 23rd May 2016 and last acted on before 2:00pm that day: created > "2016/05/23" AND request-last-activity-time < "2016/05/23 14:00"; Find issues last acted on less than one day ago: request-last-activity-time > "-1d"; Find issues last acted on in January 2016: request-last-activity-time > "2016/01/01" and request-last-activity-time < "2016/02/01" |

 **[^ top of page][3]**

 ## Resolution

 Search for issues that have a particular resolution. You can search by resolution name or resolution ID (i.e. the number that Jira automatically allocates to a resolution).

Note, it is safer to search by resolution ID than by resolution name. It is possible for your Jira administrator to change the name of a resolution, which could break any saved filter that rely on that name. Resolution IDs, however, are unique and cannot be changed.

| Syntax | `resolution` |
| --- | --- |
| Field Type | RESOLUTION |
| Auto-complete | Yes |
| Supported operators | `= , != ,` `> , >= , < , <=` `IS , IS NOT, IN , NOT IN ,` `WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Unsupported operators | `~ , !~` |
| Supported functions | None |
| Examples | Find issues with a resolution of "Cannot Reproduce" or "Won't Fix": resolution in ("Cannot Reproduce", "Won't Fix"); Find issues with a resolution ID of 5: resolution = 5; Find issues that do not have a resolution: resolution = unresolved |

 **[^ top of page][3]**

 ## Resolved

 Search for issues that were resolved on, before, or after a particular date (or date range). Please note that the search results will be relative to your configured time zone (which is by default the Jira instance's time zone).

Use one of the following formats:

`"yyyy/MM/dd"` 
 `"yyyy-MM-dd"`

 Or use `"w"` (weeks), `"d"` (days), `"h"` (hours) or `"m"` (minutes) to specify a date relative to the current time. The default is `"m"` (minutes). Be sure to use quote-marks (`"`); if you omit the quote-marks, the number you supply will be interpreted as milliseconds after epoch (1970-1-1).

| Syntax | `resolved` |
| --- | --- |
| Alias | `resolutionDate` |
| Field Type | DATE |
| Auto-complete | No |
| Supported operators | `= , != ,` `> , >= , < , <=` `IS , IS NOT, IN , NOT IN` |
| Unsupported operators | `~ , !~` `WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the EQUALS, NOT EQUALS, GREATER THAN, GREATER THAN EQUALS, LESS THAN or LESS THAN EQUALS operators, this field supports: currentLogin (); lastLogin (); now (); startOfDay (); startOfWeek (); startOfMonth (); startOfYear (); endOfDay (); endOfWeek (); endOfMonth (); endOfYear () |
| Examples | Find all issues that were resolved before 31st December 2010: resolved <= "2010/12/31"; Find all issues that were resolved before 2.00pm on 31st December 2010: resolved < "2010/12/31 14:00"; Find all issues that were resolved on or before 31st December 2010: resolved <= "2011/01/01"; Find issues that were resolved in January 2011: resolved > "2011/01/01" and resolved < "2011/02/01"; Find issues that were resolved on 15 January 2011: resolved > "2011/01/15" and resolved < "2011/01/16"; Find issues that were resolved in the last hour: resolved > -1h |

 **[^ top of page][3]**

 ## SLA

 *Used in Jira Service Management only*

 Search for requests whose SLAs are in a certain

 | Syntax | `Time to resolution` `Time to first response` < `your custom SLA name` > |
| --- | --- |
| Field Type | SLA |
| Auto-complete | No |
| Supported operators | `= , !=, > , >= , < , <=` |
| Unsupported operators | `~ , !~ / IS , IS NOT , IN , NOT IN , WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | breached(); completed(); elapsed(); everBreached(); paused(); remaining(); running(); withinCalendarHours() |
| Examples | Find issues where Time to First Response was breached: "Time to First Response" = everBreached(); Find issues where the SLA for Time to Resolution is paused due to a condition: "Time to Resolution" = paused(); Find issues where the SLA for Time to Resolution is paused due to the SLA calendar: "Time to Resolution" = withinCalendarHours(); Find issues that have been waiting for a response for more than 1 hour: "Time to First Response" > elapsed("1h"); Find issues that that will breach Time to First Response in the next two hours: "Time to First Response" < remaining("2h") |

 **[^ top of page][3]**

 ## Sprint

 Search for issues that are assigned to a particular sprint. This works for active sprints and future sprints. The search is based on either the sprint name or the sprint ID (i.e. the number that Jira automatically allocates to a sprint).

If you have multiple sprints with similar (or identical) names, you can simply search by using the sprint name — or even just part of it. The possible matches will be shown in the autocomplete drop-down, with the sprint dates shown to help you distinguish between them. (The sprint ID will also be shown, in brackets).

| Syntax | `sprint` |
| --- | --- |
| Field Type | NUMBER |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT, IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | openSprints(); closedSprints() |
| Examples | Find issues that belong to sprint 999: sprint = 999; Find issues that belong to sprint "February 1": sprint = "February 1"; Find issues that belong to either "February 1", "February 2" or "February 3": sprint in ( "February 1" , "February 2" , "February 3" ); Find issues that are assigned to a sprint: sprint is not empty |

 **[^ top of page][3]**

 ## Status

 Search for issues that have a particular status. You can search by status name or status ID (i.e. the number that Jira automatically allocates to a status).

Note:

- It is safer to search by status ID than status name. It is possible for your Jira administrator to change the name of a status, which could break any saved filter that rely on that name. Status IDs, however, are unique and cannot be changed.
- The WAS, WAS NOT, WAS IN and WAS NOT IN operators can only be used with the name, not the ID.

| Syntax | `status` |
| --- | --- |
| Field Type | STATUS |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT, IN , NOT IN ,` `WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` |
| Supported functions | None |
| Examples | Find issues with a status of "Open": status = Open; Find issues with a status ID of 1: status = 1; Find issues that currently have, or previously had, a status of "Open": status WAS Open |

 **[^ top of page][3]**

 ## Status category

 **Status category** is a system field for grouping issue [statuses][7]. Each issue status in Jira can belong to one of the three status categories: **To Do**, **In Progress**, or **Done**. You can't add or remove status categories.

These status categories represent and generalize the three main stages of an ideal issue workflow. Each issue goes from the stage where the work on it hasn't started yet, through the stage when you're working on it, to the stage when the work on has been completed.

These stages can have multiple statuses that you set for your custom workflow. For example, the custom statuses "In development" and "In review" can belong to the single status category **In Progress**, because they represent the stage where you're developing and reviewing a feature described in the issue.

| Syntax | `statusCategory` |
| --- | --- |
| Aliases | `New, Indeterminate, Complete` |
| Field Type | STATUS |
| Auto-complete | Yes |
| Supported operators | `= , !=,` `IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <=` `IS , IS NOT, WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues with the status category "To Do": statusCategory = "To Do"; Find issues with the status category ID 3 where 3 stands for closed issues: statusCategory = 3; Find all issues that are currently in progress: statusCategory not in ("To Do", "Done") |

 **[^ top of page][3]**

 ## Summary

 Search for issues where the summary contains particular text. [Jira text-search syntax][4] can be used.

| Syntax | `summary` |
| --- | --- |
| Field Type | TEXT |
| Auto-complete | No |
| Supported operators | `~ , !~` `IS , IS NOT` |
| Unsupported operators | `= , != , > , >= , < , <= / IN , NOT IN , WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues where the summary contains text that matches "Error saving file" (i.e. a "fuzzy" match): summary ~ "Error saving file"; Find issues where the summary contains the exact phrase "Error saving file": summary ~ "\"Error saving file\"" |

 **[^ top of page][3]**

 ## Text

 This is a "master-field" that allows you to search all text fields, i.e.:

- Summary
 - Description
 - Environment
 - Comments
 - custom fields that use the "free text searcher"; this includes custom fields of the following built-in custom field types:
- Free text field (unlimited text)
 - Text field (< 255 characters)
 - Read-only text field

 Notes:

- The **`text`** master-field can only be used with the CONTAINS operator (" `~` ").
- [Jira text-search syntax][4] can be used with these fields.

| Syntax | `text` |
| --- | --- |
| Field Type | TEXT |
| Auto-complete | No |
| Supported operators | `~` |
| Unsupported operators | `= , != , !~ , > , >= , < , <= / IS , IS NOT , IN , NOT IN , WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues where a text field matches the word "Fred": text ~ "Fred" or text ~ Fred; Find all issues where a text field contains the exact phrase "full screen": text ~ "\"full screen\"" |

 **[^ top of page][3]**

 ## Time spent

 *Only available if time-tracking has been enabled by your Jira administrator.*

Search for issues where the time spent is set to a particular value (i.e. a number, not a date or date range). Use "w", "d", "h" and "m" to specify weeks, days, hours, or minutes.

| Syntax | `timeSpent` |
| --- | --- |
| Field Type | DURATION |
| Auto-complete | No |
| Supported operators | `= , !=` `, > , >= , < , <= / IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~ / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues where the time spent is more than 5 days: timeSpent > 5d |

 **[^ top of page][3]**

 ## Type

 Search for issues that have a particular issue type. You can search by issue type name or issue type ID (i.e. the number that Jira automatically allocates to an issue type).

Note, it is safer to search by type ID than type name. It is possible for your Jira administrator to change the name of a type, which could break any saved filter that rely on that name. Type IDs, however, are unique and cannot be changed.

| Syntax | `type` |
| --- | --- |
| Alias | `issueType` |
| Field Type | ISSUE_TYPE |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <= / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues with an issue type of "Bug": type = Bug; Find issues with an issue typeof "Bug" or "Improvement": issueType in (Bug,Improvement); Find issues with an issue type ID of 2: issueType = 2 |

 **[^ top of page][3]**

 ## Updated

 Search for issues that were last updated on, before, or after a particular date (or date range). Note that if a time-component is not specified, midnight will be assumed. Please note that the search results will be relative to your configured time zone (which is by default the Jira instance's time zone).

Use one of the following formats:

`"yyyy/MM/dd HH:mm"` 
 `"yyyy-MM-dd HH:mm"` 
 `"yyyy/MM/dd"` 
 `"yyyy-MM-dd"`

 Or use `"w"` (weeks), `"d"` (days), `"h"` (hours) or `"m"` (minutes) to specify a date relative to the current time. The default is `"m"` (minutes). Be sure to use quote-marks (`"`); if you omit the quote-marks, the number you supply will be interpreted as milliseconds after epoch (1970-1-1).

| Syntax | `updated` |
| --- | --- |
| Alias | `updatedDate` |
| Field Type | DATE |
| Auto-complete | No |
| Supported operators | `= , !=` `, > , >= , < , <= / IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~ / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the EQUALS , NOT EQUALS, GREATER THAN, GREATER THAN EQUALS, / LESS THAN or LESS THAN EQUALS operators, this field supports: currentLogin (); lastLogin (); now (); startOfDay (); startOfWeek (); startOfMonth (); startOfYear (); endOfDay (); endOfWeek (); endOfMonth (); endOfYear () |
| Examples | Find issues that were last updated before 12th December 2010: updated < "2010/12/12"; Find issues that were last updated on or before 12th December 2010: updated < "2010/12/13"; Find all issues that were last updated before 2.00pm on 31st December 2010: updated < "2010/12/31 14:00"; Find issues that were last updated more than two weeks ago: updated < "-2w"; Find issues that were last updated on 15 January 2011: updated > "2011/01/15" and updated < "2011/01/16"; Find issues that were last updated in January 2011: updated > "2011/01/01" and updated < "2011/02/01"; Find all issues updated since January 1, 2020: updated >= "2020/01/01" |

 **[^ top of page][3]**

 ## Voter

 Search for issues for which a particular user has voted. You can search by the user's full name, ID, or email address. Note that you can only find issues for which you have the "View Voters and Watchers" permission, unless you are searching for your own votes. See also [votedIssues][8].

| Syntax | `voter` |
| --- | --- |
| Field Type | USER |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <= / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the IN and NOT IN operators, this field supports: membersOf() When used with the EQUALS and NOT EQUALS operators, this field supports: currentUser() |
| Examples | Search for issues that you have voted for: voter = currentUser(); Search for issues that the user "jsmith" has voted for: voter = "jsmith"; Search for issues for which a member of the group "Jira-administrators" has voted: voter in membersOf("Jira-administrators") |

 **[^ top of page][3]**

 ## Votes

 Search for issues with a specified number of votes.

| Syntax | `votes` |
| --- | --- |
| Field Type | NUMBER |
| Auto-complete | No |
| Supported operators | `= , !=` `, > , >= , < , <= / IN , NOT IN` |
| Unsupported operators | `~ , !~ / IS , IS NOT , WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find all issues that have 12 or more votes: votes >= 12 |

 **[^ top of page][3]**

 ## Watcher

 Search for issues that a particular user is watching. You can search by the user's full name, ID, or email address. Note that you can only find issues for which you have the "View Voters and Watchers" permission, unless you are searching for issues where you are the watcher. See also [watchedIssues][9].

| Syntax | `watcher` |
| --- | --- |
| Field Type | USER |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <= / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the IN and NOT IN operators, this field supports: membersOf() When used with the EQUALS and NOT EQUALS operators, this field supports: currentUser() |
| Examples | Search for issues that you are watching: watcher = currentUser(); Search for issues that the user "jsmith" is watching: watcher = "jsmith"; Search for issues that are being watched by a member of the group "Jira-administrators": watcher in membersOf("Jira-administrators") |

 **[^ top of page][3]**

 ## Watchers

 Search for issues with a specified number of watchers.

| Syntax | `watchers` |
| --- | --- |
| Field Type | NUMBER |
| Auto-complete | No |
| Supported operators | `= , !=` `, > , >= , < , <= / IN , NOT IN` |
| Unsupported operators | `~ , !~ / IS , IS NOT , WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find all issues that are being watched by more than 3 people: watchers > 3 |

 **[^ top of page][3]**

 ## Work log author

 *Only available if time-tracking has been enabled by your Jira administrator.*

Search for issues a particular user has logged work against. You can search by the user's full name, ID, or email address. Note that you can only find issues for which you have "Time Tracking" permissions, unless you are searching for issues that you've logged work against.

| Syntax | `worklogAuthor` |
| --- | --- |
| Field Type | USER |
| Auto-complete | Yes |
| Supported operators | `= , !=` `IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~ , > , >= , < , <= / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | When used with the IN and NOT IN operators, this field supports: membersOf() When used with the EQUALS and NOT EQUALS operators, this field supports: currentUser() |
| Examples | Search for issues that you've logged work against: worklogAuthor = currentUser(); Search for issues that the user "jsmith" has logged work against: worklogAuthor = "jsmith"; Search for issues that a member of the group "Jira-software-users": worklogAuthor in membersOf("Jira-software-users") |

 **[^ top of page][3]**

 ## Work log comment

 *Only available if time-tracking has been enabled by your Jira administrator.*

Search for issues that have a comment in a work log entry which contains particular text. [Jira text-search syntax][4] can be used.

| Syntax | `worklogComment` |
| --- | --- |
| Field Type | TEXT |
| Auto-complete | No |
| Supported operators | `~ , !~` |
| Unsupported operators | `= , != , > , >= , < , <= / IS , IS NOT , IN , NOT IN , WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues where a comment in a work log entry contains text that matches "test sessions" (i.e. a "fuzzy" match): comment ~ "test sessions"; Find issues where a comment contains the exact phrase "test sessions": summary ~ "\"test sessions\"" |

 **[^ top of page][3]**

 ## Work log date

 *Only available if time-tracking has been enabled by your Jira administrator.*

Search for issues that have comments in work log entries that were created on, before, or after a particular date (or date range). Please note that the search results are stored as a local date in the search index (are *not*  relative to your configured time zone).

Use one of the following formats:

`"yyyy/MM/dd"` 
 `"yyyy-MM-dd"`

 Or use `"w"` (weeks) or `"d"` (days) to specify a date relative to the current time. Be sure to use quote-marks (`"`); if you omit the quote-marks, the number you supply will be interpreted as milliseconds after epoch (1970-1-1).

| Syntax | `worklogDate` |
| --- | --- |
| Field Type | DATE |
| Auto-complete | No |
| Supported operators | `= , != , > , >= , < , <= / IN , NOT IN` |
| Unsupported operators | `~ , !~` `IS, IS NOT,` `WAS, WAS IN, WAS NOT, WAS NOT IN, CHANGED` |
| Supported functions | When used with the EQUALS , NOT EQUALS , GREATER THAN , GREATER THAN EQUALS , LESS THAN or LESS THAN EQUALS operators, this field supports: currentLogin(); lastLogin(); now(); startOfDay(); startOfWeek(); startOfMonth(); startOfYear(); endOfDay(); endOfWeek(); endOfMonth(); endOfYear() |
| Examples | Find issues that have comments in work log entries created before midnight 00:00 12th December 2010: worklogDate < "2010/12/12"; Find issues that have comments in work log entries created on or before 12th December 2010 (but not 13th December 2010): worklogDate <= "2010/12/13"; Find issues that have comments in work log entries created less than one day ago: worklogDate > "-1d"; Find issues that have comments in work log entries created in January 2011: worklogDate > "2011/01/01" and worklogDate < "2011/02/01"; Find issues that have comments in work log entries created on 15 January 2011: worklogDate > "2011/01/15" and worklogDate < "2011/01/16" |

 **[^ top of page][3]**

 ## Work ratio

 *Only available if time-tracking has been enabled by your Jira administrator.*

Search for issues where the work ratio has a particular value. Work ratio is calculated as follows: **workRatio = (timeSpent / originalEstimate) x 100**

 | Syntax | `workRatio` |
| --- | --- |
| Field Type | NUMBER |
| Auto-complete | No |
| Supported operators | `= , !=` `, > , >= , < , <= / IS , IS NOT , IN , NOT IN` |
| Unsupported operators | `~ , !~ / WAS, WAS IN, WAS NOT, WAS NOT IN , CHANGED` |
| Supported functions | None |
| Examples | Find issues on which more than 75% of the original estimate has been spent: workRatio > 75 |

 **[^ top of page][3]**

  Last modified on Jun 6, 2025

 Was this helpful?

Yes

  Powered by [Confluence][10] and [Scroll Viewport][11].


[1]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html
[2]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-functions-reference-1488596777.html
[3]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfieldsreference-fields
[4]: https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html
[5]: https://confluence.atlassian.com/adminjiraserver0820/configuring-issue-linking-1095777745.html
[6]: https://confluence.atlassian.com/jirasoftwareserver/customizing-cards-938845307.html
[7]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfieldsreference-Status
[8]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfieldsreference-votedIssues
[9]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingfieldsreference-watchedIssues
[10]: http://www.atlassian.com/
[11]: https://www.k15t.com/go/scroll-viewport
