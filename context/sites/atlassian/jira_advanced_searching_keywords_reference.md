---
title: "Advanced searching - keywords reference | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-keywords-reference-1488596775.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
This page describes information about keywords that are used for [advanced searching][1].

A keyword in JQL is a word or phrase that does any of the following:

- joins two or more clauses together to form a complex JQL query
- alters the logic of one or more clauses
- alters the logic of [operators][2]
- has an explicit definition in a JQL query
- performs a specific function that alters the results of a JQL query

## AND

Used to combine multiple clauses, allowing you to refine your search.

You can also use parentheses to control the order in which clauses are executed. See [Precedence in JQL queries][3] for details.

[Expand to see the examples][4]

- Find all open issues in the "New office" project:
	```
	project = "New office" and status = "open"
	```
- Find all open, urgent issues that are assigned to jsmith:
	```
	status = open and priority = urgent and assignee = jsmith
	```
- Find all issues in a particular project that are not assigned to jsmith:
	```
	project = JRA and assignee != jsmith
	```
- Find all issues for a specific release which consists of different version numbers across several projects:
	```
	project in (JRA,CONF) and fixVersion = "3.14"
	```
- Find all issues where neither the Reporter nor the Assignee is Jack, Jill or John:
	```
	reporter not in (Jack,Jill,John) and assignee not in (Jack,Jill,John)
	```

## OR

Used to combine multiple clauses, allowing you to expand your search.

You can also use parentheses to control the order in which clauses are executed. See [Precedence in JQL queries][3] for details.

[Expand to see the examples][4]

- Find all issues that were created by either jsmith or jbrown:
	```
	reporter = jsmith or reporter = jbrown
	```
- Find all issues that are overdue or where no due date is set:
	```
	duedate < now() or duedate is empty
	```

Check out the usage of [IN][5] operator, which can be a more convenient way to search for multiple values of a field.

## NOT

Used to negate individual clauses or a complex JQL query (a query made up of more than one clause) using parentheses, allowing you to refine your search.

[Expand to see the examples][4]

- Find all issues that are assigned to any user except jsmith:
	```
	not assignee = jsmith
	```
- Find all issues that were not created by either jsmith or jbrown:
	```
	not (reporter = jsmith or reporter = jbrown)
	```

Check out the usage of [NOT EQUALS][6]  ("!="), [DOES NOT CONTAIN][7]  ("!~"), [NOT IN][8]  and  [IS NOT][9] operators that are often used to negate clauses in a JQL query.

## EMPTY

Used to search for issues where a given field does not have a value. See also [NULL][10].

Note that EMPTY can only be used with fields that support the [IS][11]  and  [IS NOT][9]  operators. To see a field's supported operators, check the individual  [field][12] reference.

[Expand to see the examples][4]

- Find all issues without a DueDate:
	```
	duedate = empty
	```
	or
	```
	duedate is empty
	```

## NULL

Used to search for issues where a given field does not have a value. See also [EMPTY][13].

Note that NULL can only be used with fields that support the [IS][11]  and  [IS NOT][9]  operators. To see a field's supported operators, check the individual  [field][12] reference.

[Expand to see the examples][4]

- Find all issues without a DueDate:
	```
	duedate = null
	```
	or
	```
	duedate is null
	```

## ORDER BY

Used to specify the fields by whose values the search results will be sorted.

By default, the field's own sorting order will be used. You can override this by specifying ascending order (" `asc` ") or descending order (" `desc` ").

[Expand to see the examples][4]

- Find all issues without a DueDate, sorted by CreationDate:
	```
	duedate = empty order by created
	```
- Find all issues without a DueDate, sorted by CreationDate, then by Priority (highest to lowest):
	```
	duedate = empty order by created, priority desc
	```
- Find all issues without a DueDate, sorted by CreationDate, then by Priority (lowest to highest):
	```
	duedate = empty order by created, priority asc
	```

Ordering by **Components** or  **Versions** will list the returned issues first by  **Project**, and only then by the field's natural order (see [JRA-31113][14]).

Last modified on Aug 12, 2022

Was this helpful?

Yes

Powered by [Confluence][15] and [Scroll Viewport][16].

[1]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-1488596757.html
[2]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html
[3]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-1488596757.html#Advancedsearching-parentheses
[4]: https://confluence.atlassian.com/servicemanagementserver103/#
[5]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html#Advancedsearchingoperatorsreference-IN
[6]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html#Advancedsearchingoperatorsreference-NOT_EQUALS
[7]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html#Advancedsearchingoperatorsreference-DOES_NOT_CONTAIN
[8]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html#Advancedsearchingoperatorsreference-NOT_IN
[9]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html#Advancedsearchingoperatorsreference-IS_NOT
[10]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html#Advancedsearchingoperatorsreference-NULL
[11]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html#Advancedsearchingoperatorsreference-IS
[12]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-fields-reference-1488596774.html
[13]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearchingkeywordsreference-EMPTY
[14]: https://jira.atlassian.com/browse/JRA-31113
[15]: http://www.atlassian.com/
[16]: https://www.k15t.com/go/scroll-viewport
