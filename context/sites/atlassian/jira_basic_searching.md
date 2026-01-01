---
title: "Basic searching | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/basic-searching-1488596727.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
The basic search provides a user-friendly interface that lets you define complex queries, without needing to know how to use JQL (advanced searching).

- If you don't have complex search criteria, you may want to use [quick search][3] instead.
- If you are comfortable with the Jira Query Language (JQL), you may want to use [advanced search][4] instead. This search is more powerful than than the basic search.

*Screenshot: Basic search*

*![][1]*

## Basic searching

1. Choose **Issues**  >  **Search for issues**.  
	- If there are existing search criteria, click the **New filter** button to reset the search criteria.
	- If the advanced search is shown instead of the basic search, click **Basic**  (next to the **Search** button).
		[Why can't I switch between basic and advanced search?][5]
		In general, a query created using basic search will be able to be translated to advanced search, and back again. However, a query created using advanced search may not be able to be translated to basic search, particularly if:
		- the query contains an OR operator (note you can have an IN operator and it will be translated, e.g. `project in (A, B)`)
			- i.e. even though this query: `(project = JRA OR project = CONF)` is equivalent to this query: `(project in (JRA, CONF))`, only the second query will be translated.
		- the query contains a NOT operator
		- the query contains an EMPTY operator
		- the query contains any of the comparison operators:!=, IS, IS NOT, >, >=, <, <=
		- the query specifies a field and value that is related to a project (e.g. version, component, custom fields) and the project is not explicitly included in the query (e.g. `fixVersion = "4.0"`, without the `AND project=JRA`). This is especially tricky with custom fields since they can be configured on a Project/Issue Type basis. The general rule of thumb is that if the query cannot be created in the basic search form, then it will not be able to be translated from advanced search to basic search.
2. Enter the criteria for the search. You can search against specific fields and/or search for specific text.
	- If you are searching against a field and can't find the field you want, or the field is displaying greyed out text, see the [Troubleshooting section][6] below.
	- If you are searching for text, you can use special characters and modifiers in your search text, such as wildcards and logical operators. See [Search syntax for text fields][7].
3. The search results will automatically update in the issue navigator, unless your administrator has disabled automatic updates of search results. If so, you will need to click the **Update** button on the field drop-down after every change.

## Running a saved search

Saved searches (also known as [filters][8]) are shown in the left panel, when using basic search. If the left panel is not showing, hover your mouse over the left side of the screen to display it.

To run a filter, e.g. **My Open Issues**, simply click it. The search criteria for the basic search will be set, and the search results will be displayed.

Note, clicking the **Recently Viewed**  filter will switch you to the  advanced search, as the basic search cannot represent the `ORDER BY` clause in this filter.

![List of saved filters.][2]

List of saved filters.

## Troubleshooting

[Why can't I find the field I want to choose?][5]

Some fields are only valid for a particular *project/issue type context*. For these fields, you must select the applicable project/issue type. Otherwise, the field is not available for selection.

[Why are the field criteria displaying in grey text?][5]

Some fields are only valid for a particular *project/issue type context*. If you choose a field in your search, then remove all projects/issue types that reference the field, then the field is invalid. The invalid field does not apply to your search and displays in grey text.

[Why is there a red exclamation mark in my field?][5]

Some field values are only valid for a particular *project/issue type context*. For example, you may have configured a project to use a status  *In Review*  in its workflow. If you select this project and status in your search, then change the search to filter for a project that doesn't use  *In Review*, the status will be invalid and ignored in the search.

[Why don't my search results automatically update?][5]

Your search results will always update automatically whenever any fields are changed, provided that your administrator has not disabled automatic updates of search results. Ask your administrator whether they have disabled automatic updates of search results.

## Next steps

Read the following related topics:

- [Searching for issues][9]
- [Advanced searching][4]
- [Saving your search as a filter][8]
- [Working with search results][10] — find out how to use the issue navigator, export your search results, bulk modify issues, and share your search results.

Last modified on Apr 13, 2022

Was this helpful?

Yes

Powered by [Confluence][11] and [Scroll Viewport][12].

[1]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596727/1488596728/1/1649875008986/BasicSearching.png
[2]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596727/1488596729/1/1649856163565/filter_nav.png
[3]: https://confluence.atlassian.com/servicemanagementserver103/quick-searching-1488596750.html
[4]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-1488596757.html
[5]: https://confluence.atlassian.com/servicemanagementserver103/#
[6]: https://confluence.atlassian.com/servicemanagementserver103/#Basicsearching-troubleshooting
[7]: https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html
[8]: https://confluence.atlassian.com/servicemanagementserver103/saving-your-search-as-a-filter-1488596780.html
[9]: https://confluence.atlassian.com/servicemanagementserver103/searching-for-issues-1488596697.html
[10]: https://confluence.atlassian.com/servicemanagementserver103/working-with-search-results-1488596842.html
[11]: http://www.atlassian.com/
[12]: https://www.k15t.com/go/scroll-viewport
