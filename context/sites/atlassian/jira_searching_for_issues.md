---
title: "Searching for issues | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/searching-for-issues-1488596697.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
Can't find the customer issue you've been working on? This page will show you how to search for issues in Jira Service Management. Any agent can search for issues, although they will only see results from projects they have access to.You'll find a step-by-step guide below that will show you how to run a search and use the search results. If you want more details on anything described on this page, see the related topics at the bottom of the page.

The first step in searching for issues is to define the criteria for your new search. You can define your search criteria in three different ways: using the quick search, using the basic search, or using the advanced search.

| Quick search | The quick search is the fastest way to define search criteria. However, it is less precise than other search methods for complex queries (e.g. `project = Jira AND status = Open AND priority = High` ). It is most useful when your search criteria is not complex, for example, you know the project key and some key words for an issue. To use the quick search: Enter your search criteria in the search box in the header bar of Jira and press Enter. / Tip: If you know the issue key or project key, enter it before other search terms, e.g. "JRA help link is broken". |
| --- | --- |
| Basic search | The basic search is more precise than the quick search, but easier to use than the advanced search. It provides a user-friendly interface that lets you define complex queries, without needing to know how to use JQL (advanced searching). To use the basic search: Navigate to Issues (in header) > Search for issues , then enter your search criteria. / Tip: If the advanced search is shown instead of the basic search, click Basic next to the icon. Basic search panel. |
| Advanced search | The advanced search is the most powerful of the three search methods. You can specify criteria that cannot be defined in the other searches (e.g. `ORDER BY` clause). However, you need to know how to construct structured queries using the Jira Query Language (JQL) to use this feature. To use the advanced search: Navigate to Issues (in header) > Search for issues , then enter your search criteria. / Tip: If the basic search is shown instead of the advanced search, click Advanced next to the icon. Advanced search panel. |

## 2\. Change your view of the search results

You have crafted the perfect search criteria and run the search. Your search results will be displayed in the issue navigator. The issue navigator allows you to change how the search results are displayed. For example, you may want to bring high priority issues to the top or hide certain fields.

- **Change the sort order**: Click the column name.
- **Show/hide columns**: Click  **Columns** and choose the desired columns.

![Basic search with issues sorted by priority.][1]

Basic search with issues sorted by priority.

## 3\. Working with the search results

You've got the search results displaying the way that you want. Now you can work with the actual issues in the search results. The issue navigator lets you action individual issues, as well as the entire set of issues returned by your search.

Individual issues:

- **View the issue:** Click the issue key or name.
- **Action individual issues**: Click the cog icon next to the issue row and select an option.

All issues in the search results:

- **Export the search results to different formats, like CSV and XML:** Click **Export** and select the desired format.
- **Share the search results:** Click **Share**, then enter the recipient's details.
- **Create an RSS feed:** Click **Export > RSS (Issues)** or **RSS (Comments)**.
- **Bulk modify issues in search results**: Click  **Tools**  and select  **all *<n>* issue(s)** under **Bulk Change**.

## 4\. Save your search

If you frequently run the same search, you can save the search criteria as a filter. This saves you from having to manually redefine the search criteria every time. Jira applications also include a number of predefined system filters for common queries, such as 'My Open Issues', 'Reported by Me', 'Recently Viewed', and 'All Issues'.

**To save your search as a filter:** On the search results page, click **Save as** and enter a name for the filter. Your new filter will be shown in the left panel with your other favorite filters, filters shared with you, and the system filters. To run a filter, just click it.

## Good to know

Keep in mind that your search won't include issues that have been archived. These are removed from Jira's index, and can't be searched for like other issues.

## Next steps

Read the following related topics:

- [Quick searching][2]
- [Basic searching][3]
- [Advanced searching][4]
- [Saving your search as a filter][5]
- [Working with search results][6]

Last modified on Jun 22, 2022

Was this helpful?

Yes

Powered by [Confluence][7] and [Scroll Viewport][8].

[1]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596697/1488596698/1/1600423040509/search_issues.png
[2]: https://confluence.atlassian.com/servicemanagementserver103/quick-searching-1488596750.html
[3]: https://confluence.atlassian.com/servicemanagementserver103/basic-searching-1488596727.html
[4]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-1488596757.html
[5]: https://confluence.atlassian.com/servicemanagementserver103/saving-your-search-as-a-filter-1488596780.html
[6]: https://confluence.atlassian.com/servicemanagementserver103/working-with-search-results-1488596842.html
[7]: http://www.atlassian.com/
[8]: https://www.k15t.com/go/scroll-viewport
