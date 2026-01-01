---
title: "Advanced searching - operators reference | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
This page describes information about operators that are used for advanced searching.

An operator in JQL is one or more symbols or words that compare the value of a [field][1] on its left with one or more values or  [functions][2] on its right. So, only valid results are retrieved by the clause. Some operators may use the [NOT][3] keyword.

## EQUALS: =

The `=` operator is used to search for issues where the value of a specified field exactly matches a specified value.

To find issues where the value of a specified field exactly matches multiple values, use multiple EQUALS (`=`) statements with the [AND][4] keyword.

The operator can't be used with text fields. See the [CONTAINS][5] operator.

###### Examples

- Find all issues that were created by `jsmith`:
	```
	reporter = jsmith
	```
- Find all issues that were created by John Smith:
	```
	reporter = "John Smith"
	```

**[^top of page][6]**

## NOT EQUALS:!=

The `!=` operator is used to search for issues where the value of a specified field doesn't match a specified value.

- The operator can't be used with text fields. See the [DOES NOT MATCH][7] (`!~`) operator instead.
- `field != value` is the same as `NOT field = value`.
- `field != EMPTY`  is the same as  `field` `[IS_NOT][8] EMPTY`.
- The operator won't match a field that has no value (an empty field). For example,`component != fred` will only match issues that have a component and this component isn't "fred".To find issues that have a component other than "fred" or have no component, you should type `component != fred or component is empty`.

###### Examples

- Find all issues that are assigned to any user except `jsmith`:
	```
	not assignee = jsmith
	```
	or
	```
	assignee != jsmith
	```
- Find all issues that are not assigned to `jsmith`:
	```
	assignee != jsmith or assignee is empty
	```
- Find all issues that were reported by you but aren't assigned to you:
	```
	reporter = currentUser() and assignee != currentUser()
	```
- Find all issues where the Reporter or Assignee is anyone except John Smith:
	```
	assignee != "John Smith" or reporter != "John Smith"
	```
- Find all issues that aren't unassigned:
	```
	assignee is not empty
	```
	or
	```
	assignee != null
	```

**[^top of page][6]**

## GREATER THAN: >

The `>` operator is used to search for issues where the value of a specified field is greater than a specified value.

The operator can only be used with fields that support ordering and can't be used with text fields. For example, date fields and version fields.

To see a field's supported operators, check the individual [field reference][1].

###### Examples

- Find all issues with more than four votes:
	```
	votes > 4
	```
- Find all overdue issues:
	```
	duedate < now() and resolution is empty
	```
- Find all issues where priority is higher than "Normal":
	```
	priority > normal
	```

**[^top of page][6]**

## GREATER THAN EQUALS: >=

The `>=` operator is used to search for issues where the value of a specified field is greater than or equal to a specified value.

The operator can only be used with fields that support ordering and can't be used with text fields. For example, date fields and version fields.

To see a field's supported operators, check the individual [field reference][1].

###### Examples

- Find all issues with four or more votes:
	```
	votes >= 4
	```
- Find all issues due on or after 31/12/2008:
	```
	duedate >= "2008/12/31"
	```
- Find all issues created in the last five days:
	```
	created >= "-5d"
	```

**[^top of page][6]**

## LESS THAN: <

The `<` operator is used to search for issues where the value of a specified field is less than a specified value.

The operator can only be used with fields that support ordering and can't be used with text fields. For example, date fields and version fields.

To see a field's supported operators, check the individual [field reference][1].

###### Examples

Find all issues with less than votes:

```
votes < 4
```

  

**[^top of page][6]**

## LESS THAN EQUALS: <=

The `<=` operator is used to search for issues where the value of a specified field is less than or equal to a specified value.

The operator can only be used with fields that support ordering and can't be used with text fields. For example, date fields and version fields.

To see a field's supported operators, check the individual [field reference][1].

###### Examples

- Find all issues with four or fewer votes:
	```
	votes <= 4
	```
- Find all issues that haven't been updated in the last month (30 days):
	```
	updated <= "-4w 2d"
	```

**[^top of page][6]**

## IN

The `IN` operator is used to search for issues where the value of a specified field is one of multiple specified values. The values are specified as a comma-separated list, surrounded by parentheses.

Using `IN` is equivalent to using multiple `[EQUALS][9](=)` statements, but is shorter and more convenient. That is, `reporter IN (tom, jane, harry)` is the same as `reporter = "tom" [OR][10] reporter = "jane" [OR][10] reporter = "harry"`.

###### Examples

- Find all issues that were created by either `jsmith`, `jbrown`, or `jjones`:
	```
	reporter in (jsmith,jbrown,jjones)
	```
- Find all issues where the Reporter or Assignee is either Jack or Jill:
	```
	reporter in (Jack,Jill) or assignee in (Jack,Jill)
	```
- Find all issues in version 3.14 or version 4.2:
	```
	affectedVersion in ("3.14", "4.2")
	```

**[^top of page][6]**

## NOT IN

The `NOT IN` operator is used to search for issues where the value of a specified field isn't one of multiple specified values.

Using `NOT IN`  is equivalent to using multiple  `[NOT_EQUALS][11](!=)` statements, but is shorter and more convenient. That is, `reporter NOT IN (tom, jane, harry)` is the same as `reporter != "tom" [AND][4] reporter != "jane" [AND][4] reporter != "harry"`.

Also, the `NOT IN` operator won't match a field that has no value (a field is empty). For example,`assignee not in (jack,jill)` will only match issues that have an assignee and this assignee isn't "jack" or "jill".

To find issues that are assigned to someone other than "jack" or "jill" or are unassigned, you should type:`assignee not in (jack,jill) or assignee is empty`.

###### Examples

- Find all issues where the Assignee is someone other than Jack, Jill, or John:
	```
	assignee not in (Jack,Jill,John)
	```
- Find all issues where the Assignee isn't Jack, Jill, or John:
	```
	assignee not in (Jack,Jill,John) or assignee is empty
	```
- Find all issues where the fix version isn't A, B, C, or D:
	```
	FixVersion not in (A, B, C, D)
	```
- Find all issues where the fix version isn't A, B, C, or D, or has not been specified:
	```
	FixVersion not in (A, B, C, D) or FixVersion is empty
	```

**[^top of page][6]**

The IN and NOT IN operators allow using up to 3000 operands.

When the number of operands exceeds the allowed limit, the GET search fails because of the HTTP 400 error on Tomcat. In this case, we recommend using the `/search` resource through the POST method.

## CONTAINS: ~

The `~` operator is used to search for issues where the value of a specified field matches a specified value: either an exact or fuzzy match. See examples below.

Use it only with version and text [fields][1].

Text fields:

- Summary
- Description
- Environment
- Comments
- Custom fields that use the free text searcher, including custom fields of the following built-in custom field types:
	- Free text field (unlimited text)
	- Text field (<255 characters)
	- Read-only text field

Version fields:

- Affected version
- Fix version
- Custom fields that use the version picker

The JQL field "text", as in `text ~ "some words",`searches for an issue's summary, description, environment, comments, and all custom text fields.

If you have many text custom fields, you can improve performance of your queries by searching for specific fields. For example:`Summary ~ "some words" OR Description ~ "some words"`.

When using the ~ operator, the value on the right side of the operator can be specified by using [Jira text-search syntax][12].

###### Examples

- Find all issues where the summary contains the word "win" or the simple derivatives of this word, such as "wins":
	```
	summary ~ win
	```
- Note that for version fields, the ~ operator returns an exact match. For example, to find the version 9.0, you should use the following query:
	```
	fixVersion ~ "9.0"
	```
- Find all issues where the summary contains a wild card match for the word "win":
	```
	summary ~ "win*"
	```
- Find all issues where the summary contains the word "issue" and the word "collector":
	```
	summary ~ "issue collector"
	```
- Find all issues where the summary contains the exact phrase "full screen". Also, see [Search syntax for text fields][12] for details on how to escape quotation marks and other special characters.
	```
	summary ~ "\"full screen\""
	```
	With this query, Jira will find issues where the summaries contain both the exact phrase "full screen" and any other phrase that includes the exact word combination "full screen". For example:
	- **"full screen"**
	- create **"full screen"**
	- **"full screen"** editing mode
- Find all issues where the **Fix Version** field contains a wild card match for the version "9". For example, 9.1 or 9.0.1:
	```
	fixVersion ~ "9*"
	```
- Find all issues where the **Fix Version** field contains "9". For example, 1.9:
	```
	fixVersion ~ "*9"
	```

**[^top of page][6]**

## DOES NOT CONTAIN:!~

The `!~` operator is used to search for issues where the value of a specified field doesn't match a specified value.

Use it only with version and text [fields][1].

Text fields:

- Summary
- Description
- Environment
- Comments
- Custom fields that use the free text searcher, including custom fields of the following built-in custom field types:
	- Free text field (unlimited text)
	- Text field (<255 characters)
	- Read-only text field

Version fields:

- Affected version
- Fix version
- Custom fields that use the Version Picker

The JQL field "text", as in `text !~ "some words",`searches for an issue's summary, description, environment, comments, and all custom text fields.

If you have many text custom fields, you can improve performance of your queries by searching for specific fields. For example:`Summary !~ "some words" OR Description !~ "some words"`.

When using the`!~` operator, the value on the right side of the operator can be specified by using [Jira text-search syntax][12].

###### Examples

- Find all issues where the summary doesn't contain the word "run" or the derivatives of this word, such as "running" or "ran":
	```
	summary !~ run
	```
- Note that for version fields, the ~ operator returns an exact match. For example, to find issues where the fix version is not 9.0, you should use the following query:
	```
	fixVersion !~ "9.0"
	```
	This query will return all issues where the value in the **Fix Version** field isn't 9.0, but it won't return issues where the **Fix Version** field is empty. To find issues where this field is empty or contains any other value except for 9.0, use the following query:
	```
	fixVersion !~ "9.0" OR fixVersion is empty
	```
- Find all issues where the **Fix Version** field doesn't contain any version from the 9.x line:
	```
	fixVersion !~ "9.*"
	```

**[^top of page][6]**

## IS

The `IS` operator can only be used with the [EMPTY][13]  or  [NULL][14] keywords. That is, it's used to search for issues where the specified field has no value.

Not all fields are compatible with this operator. For more details, see the individual [field reference][1].

###### Examples

- Find all issues that have no fix version:
	```
	fixVersion is empty
	```
	or
	```
	fixVersion is null
	```

**[^top of page][6]**

## IS NOT

The `IS NOT`  operator can only be used with the [EMPTY][13]  or  [NULL][14] keywords. That is, it's used to search for issues where a specified field has a value.

Not all fields are compatible with this operator. For more details, see the individual [field reference][1].

###### Examples

- Find all issues that have one or more votes:
	```
	votes is not empty
	```
	or
	```
	votes is not null
	```

**[^top of page][6]**

## WAS

The `WAS` operator is used to find issues that currently have or previously had a specified value for a specified field.

In a search query, with this operator, you can use the following:

- `AFTER "date"`
- `BEFORE "date"`
- `BY "username"`
- `DURING ("date1","date2")`
- `ON "date"`

The `WAS` operator will match the value name (for example, "Resolved") that was configured in your system at the time when the field was changed.

The operator will also match the value ID associated with the value name. For example, it will match "4" as well as "Resolved".

The operator can be used only with the following [fields][1]:Assignee,Fix Version,Priority,Reporter,Resolution, and Status.

###### Examples

- Find issues that currently have or previously had the status "In Progress":
	```
	status WAS "In Progress"
	```
- Find issues that were resolved by Joe Smith before February 20:
	```
	status WAS "Resolved" BY jsmith BEFORE "2011/02/20"
	```
- Find issues that were resolved by Joe Smith during 2010:
	```
	status WAS "Resolved" BY jsmith DURING ("2010/01/01","2011/01/01")
	```

**[^top of page][6]**

## WAS IN

The `WAS IN` operator is used to find issues that currently have or previously had any of multiple specified values for a specified field. The values are specified as a comma-separated list, surrounded by parentheses.

In a search query, with this operator, you can use the following:

- `AFTER "date"`
- `BEFORE "date"`
- `BY "username"`
- `DURING ("date1","date2")`
- `ON "date"`

The `WAS IN` operator will match the value name (for example, "Resolved") that was configured in your systemat the time when the field was changed.

The operator will also match the value ID associated with the value name. For example, it will match "4" as well as "Resolved".

Using `WAS IN`  is equivalent to using multiple  `[WAS][15]` statements, but is shorter and more convenient. That is, `status WAS IN ("Resolved","Closed")` is the same as `status WAS "Resolved" [OR][10] status WAS "Closed"`.

The operator can be used only with the following [fields][1]:Assignee,Fix Version,Priority,Reporter,Resolution, and Status.

###### Examples

- Find all issues that currently have or previously had the status "Resolved" or "In Progress":
	```
	status WAS IN ("Resolved","In Progress")
	```

**[^top of page][6]**

## WAS NOT IN

The `WAS NOT IN` operator is used to search for issues where the value of the specified field has never been one of multiple specified values.

In a search query, with this operator, you can use the following:

- `AFTER "date"`
- `BEFORE "date"`
- `BY "username"`
- `DURING ("date1","date2")`
- `ON "date"`

Using `WAS NOT IN`  is equivalent to using multiple  `[WAS_NOT][16]` statements, but is shorter and more convenient. That is, `status WAS NOT IN ("Resolved","In Progress")` is the same as `status WAS NOT "Resolved" [AND][4] status WAS NOT "In Progress"`.

The operator can be used only with the following [fields][1]:Assignee,Fix Version,Priority,Reporter,Resolution, and Status.

###### Examples

- Find issues that have never had the status "Resolved" or "In Progress":
	```
	status WAS NOT IN ("Resolved","In Progress")
	```
- Find issues that didn't have the status "Resolved" or "In Progress" before February 20:
	```
	status WAS NOT IN ("Resolved","In Progress") BEFORE "2011/02/20"
	```

**[^top of page][6]**

The WAS IN and WAS NOT IN operators allow using up to 3000 operands.

When the number of operands exceeds the allowed limit, the GET search fails because of the HTTP 400 error on Tomcat. In this case, we recommend using the `/search` resource through the POST method.

## WAS NOT

The `WAS NOT` operator is used to find issues that have never had a specified value for a specified field.

In a search query, with this operator, you can use the following:

- `AFTER "date"`
- `BEFORE "date"`
- `BY "username"`
- `DURING ("date1","date2")`
- `ON "date"`

The `WAS NOT` operator will match the value name (for example, "Resolved") that was configured in your systemat the time when the field was changed.

The operator will also match the value ID associated with the value name. For example, it will match "4" as well as "Resolved".

The operator can be used only with the following [fields][1]:Assignee,Fix Version,Priority,Reporter,Resolution, and Status.

###### Examples

- Find issues that don't have and have never had the status "In Progress":
	```
	status WAS NOT "In Progress"
	```
- Find issues that didn't have the status "In Progress" before February 20:
	```
	status WAS NOT "In Progress" BEFORE "2011/02/20"
	```

**[^top of page][6]**

## CHANGED

The `CHANGED` operator is used to find issues where the value of a specified field was changed.

In a search query, with this operator, you can use the following:

- ```
	AFTER "date"
	```
- ```
	BEFORE "date"
	```
- ```
	BY "username"
	```
- ```
	DURING ("date1","date2")
	```
- ```
	ON "date"
	```
- ```
	FROM "oldvalue"
	```
- ```
	TO "newvalue"
	```

The operator can be used only with the following [fields][1]:Assignee,Fix Version,Priority,Reporter,Resolution, and Status.

###### Examples

- Find issues where the Assignee was changed:
	```
	assignee CHANGED
	```
- Find issues where the status was changed from "In Progress" back to "Open":
	```
	status CHANGED FROM "In Progress" TO "Open"
	```
- Find issues where the priority was changed by the user `freddo` after the start and before the end of the current week:
	```
	priority CHANGED BY freddo BEFORE endOfWeek() AFTER startOfWeek()
	```

**[^top of page][6]**

Last modified on Mar 8, 2023

Was this helpful?

Yes

Powered by [Confluence][17] and [Scroll Viewport][18].

[1]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-fields-reference-1488596774.html
[2]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-functions-reference-1488596777.html
[3]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-NOT
[4]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-AND
[5]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-CONTAINS
[6]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-operators
[7]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-DOES_NOT_MATCH
[8]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-IS_NOT
[9]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-EQUALS
[10]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-OR
[11]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-NOT_EQUALS
[12]: https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html
[13]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-EMPTY
[14]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-NULL
[15]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-WAS
[16]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingoperatorsreference-WAS_NOT
[17]: http://www.atlassian.com/
[18]: https://www.k15t.com/go/scroll-viewport
