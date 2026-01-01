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

![Quick search with annotations described below the image.](https://confluence.atlassian.com/servicemanagementserver103/files/1488596750/1488596756/1/1685342311629/quicksearch.png)

Quick search with annotations described below the image.

1. **Search:** Click anywhere in the box to display your recent work, or start typing to search through all your issues and projects.
2. **Issues:** Recent issues (before searching), or issues that match your search.
3. **Projects:** Recent projects (before searching), or projects that match your search.

Using quick search by many users at once can affect performance. You can limit the number of concurrent searches, or monitor how your users are searching in real-time. [Learn more](https://confluence.atlassian.com/adminjiraserver/configuring-advanced-settings-938847828.html)

## Understanding quick searching

Read the following topics to learn how to get the most out of quick searching:

[Jumping to an issue](https://confluence.atlassian.com/servicemanagementserver103/#Quicksearching-Jumpingtoanissue) | [Free-text searching](https://confluence.atlassian.com/servicemanagementserver103/#Quicksearching-freetextsearchingFree-textsearching) | [Using smart querying](https://confluence.atlassian.com/servicemanagementserver103/#Quicksearching-Usingsmartquerying) | [Smart querying limitations](https://confluence.atlassian.com/servicemanagementserver103/#Quicksearching-Smartqueryinglimitations)

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

For more information on free-text searching, see [Search syntax for text fields](https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html).

#### Using smart querying

Quick search also enables you to perform "smart" searches with minimal typing. For example, to find all the open bugs in the "TEST" project, you could simply type "test open bugs" and quick search would locate them all for you.

Your search results will be displayed in the Issue Navigator, where you can view them in a variety of useful formats (Excel, XML, etc).

The search terms that quick search recognizes are:

<table><colgroup><col> <col> <col></colgroup><tbody><tr><th><p>Search Term</p></th><th><p>Description</p></th><th><p>Examples</p></th></tr><tr><td><p><code>my</code></p></td><td><p>Find issues assigned to me.</p></td><td><p><code>my open bugs</code></p></td></tr><tr><td><p><code>r:</code></p></td><td><p>Find issues reported by you, another user or with no reporter, using the prefix <em>r:</em> followed by a specific reporter term, such as <em>me</em>, a username or <em>none</em>.<br><br><em>Note that there can be no spaces between "r:" and the specific reporter term.</em></p></td><td><p><code>r:me</code> — finds issues reported by you.<br><code>r:samuel</code> — finds issues reported by the user whose username is "samuel".<br><code>r:none</code> — finds issues with no reporter.</p></td></tr><tr><td><p><code>&lt;project name&gt;</code><br>or<br><code>&lt;project key&gt;</code></p></td><td><p>Find issues in a particular project.</p></td><td><p><code>test</code><br><code>TST</code><br><code>tst</code></p></td></tr><tr><td><p><code>overdue</code></p></td><td><p>Find issues that were due before today.</p></td><td><p><code>overdue</code></p></td></tr><tr><td><p><code>created:</code><br><code>updated:</code><br><code>due:</code></p></td><td><p>Find issues with a particular Created, Updated, or Due Date using the prefixes <em>created:</em>, <em>updated:</em>, or <em>due:</em>, respectively. For the date range, you can use <em>today</em>, <em>tomorrow</em>, <em>yesterday</em>, a single date range (e.g. '-1w'), or two date ranges (e.g. '-1w,1w'). Note that date ranges cannot have spaces in them. Valid date/time abbreviations are: 'w' (week), 'd' (day), 'h' (hour), 'm' (minute).</p></td><td><p><code>created:today</code><br><code>created:yesterday</code><br><code>updated:-1w</code> — finds issues updated in the last week.<br><code>due:1w</code> — finds issues due in the next week.<br><code>due:-1d,1w</code> — finds issues due from yesterday to next week.<br><code>created:-1w,-30m</code> — finds issues created from one week ago, to 30 minutes ago.<br><code>created:-1d updated:-4h</code> — finds issues created in the last day, updated in the last 4 hours.</p></td></tr><tr><td><p><code>&lt;priority&gt;</code></p></td><td><p>Find issues with a particular Priority.</p></td><td><p><code>blocker</code><br><code>major</code><br><code>trivial</code></p></td></tr><tr><td><p><code>&lt;issue type&gt;</code></p></td><td><p>Find issues with a particular Issue Type. Note that you can also use plurals.</p></td><td><p><code>bug</code><br><code>task</code><br><code>bugs</code><br><code>tasks</code></p></td></tr><tr><td colspan="1"><p><code>&lt;resolution&gt;</code></p></td><td colspan="1"><p>Find issues with a particular Resolution.</p></td><td colspan="1"><p><code>fixed<br>duplicate<br></code></p></td></tr><tr><td><p><code>c:</code></p></td><td><p>Find issues with a particular Component(s). You can search across multiple components.<br><br><em>Note that there can be no spaces between "c:" and the component name.</em></p></td><td><p><code>c:security</code> — finds issues with a component whose name contains the word "security".</p></td></tr><tr><td><p><code>v:</code></p></td><td><p>Find issues with a particular Affects Version(s). To find all issues belonging to a 'major' version, use the <a href="https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html">wildcard</a> symbol <code>'*'</code>.<br><br><em>Note that there can be no spaces between "v:" and the version name.</em></p></td><td><p><code>v:3.0</code> — finds issues that match the following versions (for example):<br><br></p><ul><li><p>3.0</p></li><li><p>3.0 eap</p></li><li><p>3.0 beta</p><p>...but will not match against the following versions (for example):</p></li><li><p>3.0.1</p></li><li><p>3.0.0.4</p><p>That is, it will match against any version that contains the string you specify followed immediately by a space, but not against versions that do not contain a space immediately after the string you specify.</p></li></ul></td></tr><tr><td><p><code>ff:</code></p></td><td><p>Find issues with a particular Fix For Version(s). Same usage as <code>v:</code> (above).</p></td><td><p><br></p></td></tr><tr><td><p><code>*</code></p></td><td><p><a href="https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html">Wildcard</a> symbol <code>'*'</code>. Can be used with <code>v:</code> and <code>ff:</code>.</p></td><td><p><code>v:3.2*</code> — finds any issue whose version number is (for example):</p><ul><li><p>3.2</p></li><li><p>3.2-beta</p></li><li><p>3.2.1</p></li><li><p>3.2.x</p></li></ul></td></tr></tbody></table>

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

![](https://confluence.atlassian.com/servicemanagementserver103/files/1488596750/1488596751/1/1685342311288/Smart_query+%284%29.png)

1. **Quick searching** preference where you can select a default mode for quick search.

## Searching issues from your browser's search box

If you are using Firefox or Internet Explorer 8 (or later), you can add your Jira instance  as a search engine/provider via the drop-down menu next to the browser's search box. Once you add your Jira instance  as a search engine/provider in your browser, you can use it at any time to conduct a Quick Search for issues in that Jira instance.

OpenSearch

Jira supports this browser search feature as part of the autodiscovery part of the [OpenSearch](http://www.opensearch.org/) standard, by supplying an OpenSearch description document. This is an XML file that describes the web interface provided by Jira's search function. Any [client applications](http://www.opensearch.org/Community/OpenSearch_enabled_search_clients) that support OpenSearch will be able to add Jira to their list of search engines.

## Next steps

Read the following related topics:

- [Searching for issues](https://confluence.atlassian.com/servicemanagementserver103/searching-for-issues-1488596697.html)

Last modified on May 16, 2025

Was this helpful?

Yes

Powered by [Confluence](http://www.atlassian.com/) and [Scroll Viewport](https://www.k15t.com/go/scroll-viewport).