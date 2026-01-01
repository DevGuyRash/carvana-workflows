---
title: "Advanced searching | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-1488596757.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
The advanced search allows you to build structured queries using the Jira Query Language (JQL) to search for issues. You can specify criteria that can't be defined in the quick or basic searches. For example, you can use the `ORDER BY` clause to sort Jira issues either in descending or ascending order or narrow down your search results for the desired date range.

Learn more about searching in Jira from [JQL: The most flexible way to search Jira (on the Atlassian blog)][4]

Before using the advanced search, consider the following:

- If you don't have complex search criteria, you may want to use [quick search][5] instead.
- If you're not comfortable with the Jira Query Language (JQL), you may want to use [basic search][6] instead.

Note that JQL isn't a database query language, even though it uses SQL-like syntax.

The following is the e xample of an advanced search query in Jira that returns all issues for the **Teams in the space** project.

![][1]

1. **JQL query** that refines the search results.
2. A list of Jira **issues** that match the search criteria.

## Using advanced search

1. Select **Issues** from the top navigation bar, then **Search for issues**.  
	![][2]  
	- If there are existing search criteria, select the **New search** button to reset the search criteria.
	- If the basic search is shown instead of the advanced search, select **Advanced**  (next to the **Search** button).  
		![][3]
		If you can't switch to an advanced search, check out the [following][7] section.
2. Enter your JQL query. As you type, Jira will offer a list of "auto-complete" suggestions based on the context of your query. Note that auto-complete suggestions only include the first 15 matches, displayed alphabetically, so you may need to enter more text if you can't find a match.  
	[Why aren't the auto-complete suggestions being shown?][8]
	If you don’t see auto-complete suggestions, this might happen because of the following:
	- Your administrator may have disabled the "JQL Auto-complete" feature for your Jira instance.
	- Auto-complete suggestions aren't offered for function parameters.
	- Auto-complete suggestions aren't offered for all fields. Check the [fields][9] reference to see which fields support auto-complete.
3. Press Enter or select **Search** to run your query. Your search results will display in the issue navigator.

  

Unless specified in the search query, note that JQL searches don't return empty fields in results. To include empty fields (e.g. unassigned issues) when searching for issues that aren't assigned to the current user, you' d enter (assignee!= currentUser() OR assignee is EMPTY) to include unassigned issues in the list of results.

In general, a query created using basic search will be able to be translated to advanced search and back again. However, sometimes a query created using an advanced search may not be able to be translated into a basic search. Expand the following section for details.

[Why can't I switch between basic and advanced search?][8]

You might not be able to switch between two searches if:

- the query contains an `OR` operator.
	You can have an IN operator and it will be translated, e.g. `project in (A, B). E` ven though this query: `(project = JRA OR project = CONF)` is equivalent to this query: `(project in (JRA, CONF)`, only the second query will be translated.
- the query contains a `NOT` operator.
- the query contains an `EMPTY` operator.
- the query contains any of the comparison operators: `!=`, `IS`, IS NOT, >, `>=`, `<`, `<=`.
- the query specifies a field and value that is related to a project (e.g. version, component, custom fields) and the project is not explicitly included in the query (e.g. `fixVersion = "4.0"`, without the `AND project=JRA`). This is especially tricky with custom fields since they can be configured on a Project/Issue Type basis. The general rule of thumb is that if the query cannot be created in the basic search form, then it won't be able to be translated from advanced search to basic search.

Understanding advanced searching

Read the following topics to learn how to get the most out of advanced searching:

### Constructing JQL queries

A simple query in JQL (also known as a "clause") consists of a *field*, followed by an  *operator*, followed by one or more  *values*  or  *functions*.

**Example 1**

This query will find all issues in the `TEST` project.

```
project = "TEST"
```

This query will find all issues in the `TEST` project. It uses the `project` *field*, the  `EQUALS` *operator*, and the  *value* TEST.

**Example 2**

A more complex query might look like this:

```
project = "TEST" AND assignee = currentUser()
```

This query will find all issues in the `TEST` project where the `assignee` is the currently logged in user. It uses the `project` *field*, the EQUALS  *operator*, the  *value* `TEST,`the `AND` keyword and the `currentUser()` function.

**Example 3**

A JQL query that will search for more than one value of a specific field. This query will find all issues of type `Bug`, which have `accessibility` and `"3rd-party apps"` values for the `Component` field:

```
issuetype =  Bug AND component in (accessibility, "3rd-party apps")
```

The query uses the `issuetype` field, the `EQUALS` operator, the value `Bug`,the `AND` keyword, the `component` field, and the `IN` operator.

**Example 4**

A JQL query that will find issues created since the start of the current year and updated since the start of the current month:

```
project = "Analytics" and created > startOfYear() and updated > startOfMonth()
```

**Example 5**

A JQL query that will find any issues that are created in the `Test` project and contain the "pre-landing report" text in a summary or description:

```
project = "Test" AND text ~ "pre-landing report"
```

For more information on fields, operators, keywords and functions, see the [Reference section][10].

### Precedence in JQL queries

Precedence in JQL queries depends on keywords that you use to connect your clauses. For example, a clause can be: `project = “Teams in Space”`. The easiest way to look at this is to treat the `AND` keyword as the one grouping clauses, and `OR` as the one separating them. The `AND` keyword takes precedence over other keywords, because it groups clauses together, essentially turning them into one combined clause.

**Example 1**

```
status=resolved AND project=“Teams in Space” OR assignee=captainjoe
```

This query will return all `resolved` issues from the `Teams in Space` project (clauses grouped by `AND`), and also all existing issues assigned to `captainjoe`. The clause after the `OR` keyword is treated as separate.

**Example 2**

```
status=resolved OR project="Teams in Space" AND assignee=captainjoe
```

This query, on the other hand, will return *captainjoe’s* issues from the `Teams in Space` project (clauses grouped by `AND`), and also all existing `resolved` issues (a clause separated by `OR`).

**Example 3**

```
status=resolved OR projects="Teams in Space" OR assigne=captainjoe
```

When you only use the `OR` keyword, all clauses will be treated as separate, and equal in terms of precedence.

#### Setting the precedence

You can set precedence in your JQL queries by using parentheses. Parentheses will group certain clauses together and enforce precedence.

**Example 1**

As you can see in this example, parentheses can turn our example JQL query around. This query would return `resolved` issues that either belong to the `Teams in Space` project or are assigned to `captainjoe`.

```
status=resolved AND (project="Teams in Space" OR assignee=captainjoe)
```

**Example 2**

If you used parentheses like in the following example, they wouldn’t have any effect, because the clauses enclosed in parentheses were already connected by `AND`. This query would return the same results with or without the parentheses.

```
(status=resolved AND project="Teams in Space") OR assignee=captainjoe
```

### Restricted words and characters

#### Reserved characters

JQL has a list of reserved characters:

|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `space (" ")` | `+` | `.` | `,` | `;` | `?` | `|` | `*` |  | `%` | `^` | `$` | `#` | `@` | `[` | `]` |

If you wish to use these characters in queries, you need to:

- Surround them with quote-marks. You can use either single quotation marks (`'`) or double quotation marks (`"`).  
	and
- If you are searching a **text field** and the character is on the list of  [special characters in text searches][12], precede them with two backslashes. This will let you run the query that contains a reserved character, but the character itself will be ignored in your query. For more information, see **Special characters** in [Search syntax for text fields][12].

For example:

- ```
	version = "[example]"
	```
- ```
	summary ~ "\\[example\\]"
	```

#### Reserved words

JQL also has a list of reserved words. These words need to be surrounded by quotation marks (single or double) if you wish to use them in queries.

[Expand to see the list of reserved words][8]

"abort", "access", "add", "after", "alias", "all", "alter", "and", "any", "as", "asc", "audit", "avg", "before", "begin", "between", "boolean", "break", "by", "byte", "catch", "cf", "char", "character", "check", "checkpoint", "collate", "collation", "column", "commit", "connect", "continue", "count", "create", "current", "date", "decimal", "declare", "decrement", "default", "defaults", "define", "delete", "delimiter", "desc", "difference", "distinct", "divide", "do", "double", "drop", "else", "empty", "encoding", "end", "equals", "escape", "exclusive", "exec", "execute", "exists", "explain", "false", "fetch", "file", "field", "first", "float", "for", "from", "function", "go", "goto", "grant", "greater", "group", "having", "identified", "if", "immediate", "in", "increment", "index", "initial", "inner", "inout", "input", "insert", "int", "integer", "intersect", "intersection", "into", "is", "isempty", "isnull", "join", "last", "left", "less", "like", "limit", "lock", "long", "max", "min", "minus", "mode", "modify", "modulo", "more", "multiply", "next", "noaudit", "not", "notin", "nowait", "null", "number", "object", "of", "on", "option", "or", "order", "outer", "output", "power", "previous", "prior", "privileges", "public", "raise", "raw", "remainder", "rename", "resource", "return", "returns", "revoke", "right", "row", "rowid", "rownum", "rows", "select", "session", "set", "share", "size", "sqrt", "start", "strict", "string", "subtract", "sum", "synonym", "table", "then", "to", "trans", "transaction", "trigger", "true", "uid", "union", "unique", "update", "user", "validate", "values", "view", "when", "whenever", "where", "while", "with"

If you’re a Jira admin, note that this list is hard coded in the `JqlStringSupportImpl.java` file.

  

### Performing text searches

You can use Lucene's text-searching features when performing searches on the following fields by using the `CONTAINS` operator.

When searching for text fields, you can also use single and multiple character [wildcard searches][13]. For more information, see [Search syntax for text fields][12].

### Differences between day and time search

A day (1d) and time (24h) values are differently calculated in a query and don’t return the same results:

- If you specify "1d", the start of the day will start calculating at 00:00 of the server timezone unless you also add the exact time. "1d" will also include the current day if you execute the query now. It doesn't take into account the amount of time relative to the time you had executed the query (24 hours from the time you executed the JQL).
- If you use "24h", it will start calculating from the hour when you executed it (-24 hours from the time you run the JQL).

**Example**

Let's assume that you updated an issue's status to "Closed" yesterday at 3 PM. You run the following queries at 1 PM today:

- `status changed to "Closed" after -1d ` won't return the closed issue. However, it'll return the result if you run `status changed to "Closed" after -2d`.
- `status changed to "Closed" after -24h` will return the closed issue.

## Reference

Here you can find a brief overview of Jira fields, operators, keywords, and functions used to compose JQL queries. For detailed description and examples of their usage for advance searching, check the links from the **Reference** column.

|  | Description | Reference |
| --- | --- | --- |
| Fields | A field in JQL is a word that represents a Jira field (or a custom field that has already been defined in Jira). You can perform an advanced search on your Jira fields to look for issues created on, before, or after a particular date (or date range) and time. | To view a detailed information about fields and how to use them for advanced searching, check out Fields reference page . Show list of fields affectedVersion; approvals; assignee; attachments; category; comment; component; created; creator; customFieldName; "Customer Request Type"; description; due; environment; "epic link"; filter; fixVersion; issueKey; Issue link type; labels; lastViewed; level; originalEstimate; parent; priority; project; remainingEstimate; reporter; request-channel-type; request-last-activity-time; resolution; resolved; sprint; status; summary; text; timeSpent; type; updated; voter; votes; watcher; watchers; worklogAuthor; WorklogComment; WorklogDate; WorkRatio |
| Operators | An operator in JQL is one or more symbols or words that compare the value of a field on its left with one or more values (or functions) on its right, such that only true results are retrieved by the clause. Some operators may use the NOT keyword. | To view a detailed information about operators and how to use them for advanced searching, check out Operators reference page . Show list of operators EQUALS: =; NOT EQUALS: !=; GREATER THAN: >; GREATER THAN EQUALS: >=; LESS THAN: <; LESS THAN EQUALS: <=; IN; NOT IN; CONTAINS: ~; DOES NOT CONTAIN: !~; IS; IS NOT; WAS; WAS IN; WAS NOT IN; WAS NOT; CHANGED |
| Keywords | A keyword in JQL is a word or phrase that does (or is) any of the following: joins two or more clauses together to form a complex JQL query.; alters the logic of one or more clauses.; alters the logic of operators.; has an explicit definition in a JQL query.; performs a specific function that alters the results of a JQL query. | To view a detailed information about keywords and how to use them for advanced searching, check out Keywords reference page . Show list of keywords AND; OR; NOT; EMPTY; NULL; ORDER BY |
| Functions | A function in JQL appears as a word followed by parentheses, which may contain one or more explicit values or Jira fields. A function performs a calculation on either specific Jira data or the function's content in parentheses, such that only true results are retrieved by the function, and then again by the clause in which the function is used. | To view a detailed information about functions and how to use them for advanced searching, check out Functions reference page . |

## Running a saved search

You can find saved searches (also known as [Saving your search as a filter][14]) in the left-side panel, when using advanced search. If the left panel is not showing, hover your mouse over the left side of the screen to display it.

To run a filter, such as **New\_issues**, select the filter name. The JQL for the advanced search will be set, and the search results will be displayed.

![][11]

1. A **search saved as a filter**, which returns issues based on the criteria specified in a JQL query.
2. **JQL query** that specifies search criteria.
3. **Issues** that match the search criteria.

If you want to delete a saved search, see [Deleting a filter][15].

## Notes

To find out the version of Lucene Jira Software is using, go to `/Installation-directory/atlassian-jira/WEB-INF/lib` and locate the Lucene jar files. The Lucene version number will be part of the filename.

Last modified on Aug 30, 2024

Was this helpful?

Yes

Powered by [Confluence][16] and [Scroll Viewport][17].

[1]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596757/1488596772/1/1716561582585/Advanced_search+%284%29.png
[2]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596757/1488596770/1/1716561582504/Search_for_issues2.png
[3]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596757/1488596771/1/1716561582547/Advanced_search+%282%29.png
[4]: https://blogs.atlassian.com/2013/01/jql-the-most-flexible-way-to-search-jira-14/
[5]: https://confluence.atlassian.com/servicemanagementserver103/quick-searching-1488596750.html
[6]: https://confluence.atlassian.com/servicemanagementserver103/basic-searching-1488596727.html
[7]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearching-switch_search
[8]: https://confluence.atlassian.com/servicemanagementserver103/#
[9]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearching-fields
[10]: https://confluence.atlassian.com/servicemanagementserver103/#Advancedsearching-reference
[11]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596757/1488596773/1/1716561582622/Saved_search3.png
[12]: https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html
[13]: https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html#Searchsyntaxfortextfields-wildcards
[14]: https://confluence.atlassian.com/servicemanagementserver103/saving-your-search-as-a-filter-1488596780.html
[15]: https://confluence.atlassian.com/servicemanagementserver103/saving-your-search-as-a-filter-1488596780.html#Savingyoursearchasafilter-delete_filter
[16]: http://www.atlassian.com/
[17]: https://www.k15t.com/go/scroll-viewport
