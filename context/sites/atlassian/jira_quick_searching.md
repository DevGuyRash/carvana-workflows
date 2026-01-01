---
title: "Quick searching | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/quick-searching-1488596750.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
Sometimes, you just want to be able to get to the particular issue that you're interested in. Other times, you can't remember what the issue was, but you remember that it was an open issue, assigned to you, or you have its name on the tip of your tongue. Quick search can help you in these scenarios.

The **Search** box is located at the top right of your screen, in the Jira header bar. To use quick search, just start typing what you're looking for.

![Quick search with annotations described below the image.][1]

Quick search with annotations described below the image.

1. **Search:** Click anywhere in the box to display your recent work, or start typing to search through all your issues and projects.
2. **Issues:** Recent issues (before searching), or issues that match your search.
3. **Projects:** Recent projects (before searching), or projects that match your search.

Using quick search by many users at once can affect performance. You can limit the number of concurrent searches, or monitor how your users are searching in real-time. [Learn more][2]

## Understanding quick searching

Read the following topics to learn how to get the most out of quick searching:

[Jumping to an issue][3] | [Free-text searching][4] | [Using smart querying][5] | [Smart querying limitations][6]

### Jumping to an issue

If you type in the **key**  of an issue, you will jump straight to that issue. For example, if you type in 'ABC-107' (or 'abc-107'), and press the  **Enter** button, you will be redirected to the issue 'ABC-107'.

In many cases, you do not even need to type in the full key, but just the numerical part. If you are currently working on the 'ABC' project, and you type in '123', you will be redirected to 'ABC-123'.

Searching as you type

When you start typing the word you’re looking for, the quick search will react instantly by showing and refreshing the list of most relevant results. To display these results, your search term is matched against the following fields:

- Summary (projects and issues)
- Description (issues)

### Free-text searching

You can additionally search through comments or use extra operators for fuzzy or wildcard search. These results won't be displayed as 'instant results', but you can view them after pressing **Enter** in the search box.

You can combine free-text and keywords together, e.g. " `my closed test tasks` ". You can also you wildcards, e.g. '' `win*8` ".

For more information on free-text searching, see [Search syntax for text fields][7].

#### Using smart querying

Quick search also enables you to perform "smart" searches with minimal typing. For example, to find all the open bugs in the "TEST" project, you could simply type "test open bugs" and quick search would locate them all for you.

Your search results will be displayed in the Issue Navigator, where you can view them in a variety of useful formats (Excel, XML, etc).

The search terms that quick search recognizes are:

| Search Term | Description | Examples |
| --- | --- | --- |
| `my` | Find issues assigned to me. | `my open bugs` |
| `r:` | Find issues reported by you, another user or with no reporter, using the prefix r: followed by a specific reporter term, such as me , a username or none . / Note that there can be no spaces between "r:" and the specific reporter term. | `r:me` — finds issues reported by you. / `r:samuel` — finds issues reported by the user whose username is "samuel". / `r:none` — finds issues with no reporter. |
| `<project name>` / or / `<project key>` | Find issues in a particular project. | `test` / `TST` / `tst` |
| `overdue` | Find issues that were due before today. | `overdue` |
| `created:` / `updated:` / `due:` | Find issues with a particular Created, Updated, or Due Date using the prefixes created: , updated: , or due: , respectively. For the date range, you can use today , tomorrow , yesterday , a single date range (e.g. '-1w'), or two date ranges (e.g. '-1w,1w'). Note that date ranges cannot have spaces in them. Valid date/time abbreviations are: 'w' (week), 'd' (day), 'h' (hour), 'm' (minute). | `created:today` / `created:yesterday` / `updated:-1w` — finds issues updated in the last week. / `due:1w` — finds issues due in the next week. / `due:-1d,1w` — finds issues due from yesterday to next week. / `created:-1w,-30m` — finds issues created from one week ago, to 30 minutes ago. / `created:-1d updated:-4h` — finds issues created in the last day, updated in the last 4 hours. |
| `<priority>` | Find issues with a particular Priority. | `blocker` / `major` / `trivial` |
| `<issue type>` | Find issues with a particular Issue Type. Note that you can also use plurals. | `bug` / `task` / `bugs` / `tasks` |
| `<resolution>` | Find issues with a particular Resolution. | `fixed / duplicate` |
| `c:` | Find issues with a particular Component(s). You can search across multiple components. / Note that there can be no spaces between "c:" and the component name. | `c:security` — finds issues with a component whose name contains the word "security". |
| `v:` | Find issues with a particular Affects Version(s). To find all issues belonging to a 'major' version, use the wildcard symbol `'*'` . / Note that there can be no spaces between "v:" and the version name. | `v:3.0` — finds issues that match the following versions (for example): / 3.0; 3.0 eap; 3.0 beta ...but will not match against the following versions (for example):; 3.0.1; 3.0.0.4 That is, it will match against any version that contains the string you specify followed immediately by a space, but not against versions that do not contain a space immediately after the string you specify. |
| `ff:` | Find issues with a particular Fix For Version(s). Same usage as `v:` (above). |  |
| `*` | Wildcard symbol `'*'` . Can be used with `v:` and `ff:` . | `v:3.2*` — finds any issue whose version number is (for example): 3.2; 3.2-beta; 3.2.1; 3.2.x |

In Mozilla-based browsers, try creating a bookmark with URL `http://<your-Jira-site>/secure/QuickSearch.jspa?searchString=%s` (substituting `<your-Jira-site>` with your Jira instance 's URL) and keyword (such as *'j'*). Now, typing *'j my open bugs'* in the browser URL bar will search your Jira instance for your open bugs. Or simply type your search term in the Quick Search box, then right-click on the Quick Search box (with your search term shown) and select "Add a Keyword for this search...".

#### Smart querying limitations

When using Jira's quick search, multi-word issue types or project names that contain spaces or dashes might not be interpreted correctly. For example, if you search for my Service Request, Jira will interpret it as:

```
assignee = currentUser() AND text ~ "Service Request"
```

Instead of:

```
issuetype = "Service Request" AND assignee = currentUser()
```

To get accurate results in such situations, use the full JQL syntax.

#### Disabling smart querying

If you don’t want to use smart query as a default search behavior, you can disable it in your User profile, in the **Preferences** section.

In the **quick searching** setting, select **Text** as a quick searching mode. Jira will no longer update your search strings and will use the exact search strings to find what you’re looking for.

![][8]

1. **Quick searching** preference where you can select a default mode for quick search.

## Searching issues from your browser's search box

If you are using Firefox or Internet Explorer 8 (or later), you can add your Jira instance  as a search engine/provider via the drop-down menu next to the browser's search box. Once you add your Jira instance  as a search engine/provider in your browser, you can use it at any time to conduct a Quick Search for issues in that Jira instance.

OpenSearch

Jira supports this browser search feature as part of the autodiscovery part of the [OpenSearch][9] standard, by supplying an OpenSearch description document. This is an XML file that describes the web interface provided by Jira's search function. Any [client applications][10] that support OpenSearch will be able to add Jira to their list of search engines.

## Next steps

Read the following related topics:

- [Searching for issues][11]

Last modified on May 16, 2025

Was this helpful?

Yes

Powered by [Confluence][12] and [Scroll Viewport][13].

[1]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596750/1488596756/1/1685342311629/quicksearch.png
[2]: https://confluence.atlassian.com/adminjiraserver/configuring-advanced-settings-938847828.html
[3]: https://confluence.atlassian.com/servicemanagementserver103/#Quicksearching-Jumpingtoanissue
[4]: https://confluence.atlassian.com/servicemanagementserver103/#Quicksearching-freetextsearchingFree-textsearching
[5]: https://confluence.atlassian.com/servicemanagementserver103/#Quicksearching-Usingsmartquerying
[6]: https://confluence.atlassian.com/servicemanagementserver103/#Quicksearching-Smartqueryinglimitations
[7]: https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html
[8]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596750/1488596751/1/1685342311288/Smart_query+%284%29.png
[9]: http://www.opensearch.org/
[10]: http://www.opensearch.org/Community/OpenSearch_enabled_search_clients
[11]: https://confluence.atlassian.com/servicemanagementserver103/searching-for-issues-1488596697.html
[12]: http://www.atlassian.com/
[13]: https://www.k15t.com/go/scroll-viewport
