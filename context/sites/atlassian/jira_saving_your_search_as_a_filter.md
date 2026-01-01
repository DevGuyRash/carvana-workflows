---
title: "Saving your search as a filter | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/saving-your-search-as-a-filter-1488596780.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
Jira's powerful [issue search][3]  functionality is enhanced by the ability to save searches, called  *filters* in Jira, for later use. You can do the following with Jira filters:

- Share and email search results with your colleagues, as well as people outside of your organization
- Create lists of [favorite filters][4]
- Have search results [emailed to you][5] according to your preferred schedule
- View and export the search results in various formats (RSS, Excel, etc)
- Display the search results in a report format
- Display the search results in a [dashboard gadget][6]

*Screenshot: Issue filter results in detail view* *![][1]*

## Saving a search as a filter

1. Define and run your search.
2. Click the **Save as** link above the search results. The **Save Filter** dialog is displayed.
3. Enter a name for the new filter and click **Submit**. Your filter is created.

Your new filter will be added to your favorite filters and shared, according to the sharing preference in your user profile. If you haven't specified a preference, then the global default will be applied, which is 'Private' unless changed by your Jira administrator.

## Running a filter

1. Choose **Issues**  >  **Search for issues**.
2. Choose any filter from the list on the left:  
	- System filter — **My Open Issues, Reported by Me, Recently Viewed, All Issues**
	- Favorite filters (listed alphabetically)
	- **Find filters**  lets you search for any filter that's been  shared, which you can then subscribe to (adding it to your **Favorite Filters**).
3. After selecting a filter, the search results are displayed. The search criteria for the filter are also displayed and can be changed.  
	*Note, if you run the **Recently Viewed** system filter, this will switch you to the advanced search, as the basic search cannot represent the `ORDER BY` clause in this filter.*

## Managing your existing filters

Click **Issues > Manage filters** to manage your filters.

![Manage filters page, with a list of saved filters.][2]

Manage filters page, with a list of saved filters.

The **Manage Filters** page allows you to view and configure filters that you have created, as well as work with filters that other users have shared with you. See the following topics for more information:

### Searching for a filter

You can find and run any filters that you have created or that have been shared by other users.

1. Click the **Search** tab on the 'Manage Filters' page.
2. Enter your search criteria and click **Search** to run the search.
3. Your search results are displayed on the same page. Click the name of any issue filter to run it.

*Tip: If the filter has been added as a favorite by many users, you may also be able locate it on the **Popular** tab of the **Manage Filters*** *page.*

### Updating a filter

You can update the name, description, sharing, favorite of any filters that you created, or have permission to edit. If you want to edit a filter for which you only have the *view* permission, either [clone][7] (aka copy) the shared filter, or ask your Jira administrator to [change the filter's ownership][8].

Update the filter's details:

1. Click the **My** tab on the 'Manage Filters' page.
2. Locate the filter you wish to update, click the **cog icon** > **Edit**.
3. The **Edit Current Filter** page displays, where you can update the filter details as required.
4. Click **Save** to save your changes.

If you have an editor role assigned and want to save changes to a filter, you **must** be a member of all groups that the filter is shared with. Otherwise, you will not be able to save the changes.

  

Update the filter's search criteria:

1. Click the **My** tab on the 'Manage Filters' page.
2. Locate the filter you want to update and run it.
3. Update the search criteria as desired, and rerun the query to ensure the update is valid. You will see the word *Edited* displayed next to your filter name.
4. Click **Save** to overwrite the current filter with the updated search criteria. If you want discard your changes instead, click the arrow next to the save button, and select **Discard changes**.

### Deleting a filter

1. Click the **My** tab on the 'Manage Filters' page.
2. Locate the filter you wish to delete, click the **cog icon** > **Delete**.

### Cloning a filter

You can clone any filter – which is just a way of making a copy that you own – that was either created by you or shared with you.

1. Locate the filter you wish to clone and run it.
2. Update the search criteria as desired. Click the arrow next to the **Save** button, and select **Save >** **Save as** to create a new filter from the existing filter.

Filters that you've created or that have been shared by others can be added to your favorite filters. Favorite filters are listed in the menu under **Issues > Filters**, and in the left panel of the issue navigator.

1. Locate the filter you wish to add as a favorite.
2. Click the star icon next to the filter name to add it to your favorites.

### Sharing a filter

Filters that you have created or have permission to edit can be shared with other users, user groups, projects, and project roles. They can also be shared globally. You can choose whether you want to share the filter with the permission to edit, or only to view. Any filter that is shared is visible to users who have the 'Jira Administrators' global permission. See [Managing other users' shared filters][8] below.

1. Click the **My** tab on the 'Manage Filters' page.
2. Locate the filter you wish to share, click the **cog icon** > **Edit**.
3. Update the **Add Viewers** and **Add Editors** fields by selecting the user, group, project, or project role that you want to share the filter with, and clicking **Add**. Note that you can only share filters with groups/roles of which you are a member.
	[Why can't I see the filter's sharing configuration?][9]
	*You need the Create Shared Object global permission to configure sharing for a filter. Contact your Jira administrator to obtain this permission.*
4. Click **Save** to save your changes.

*Tip: You can also share your filter by running it, then clicking **Details** > **Edit Permissions**.*

### Defining a filter-specific column order

You can add a defined column order to a saved filter, which displays the filter results according to the saved column order. Otherwise, the results are displayed according to your personal column order (if you have set this) or the system default.

*Tip: To display your configured column order in a filter subscription, select '' for the 'Outgoing email format' in your **User Profile**. If you receive text emails from Jira, you won't be able to see your configured column order.*

**To add a column layout to a saved filter:**

1. Click the **My** tab on the 'Manage Filters' page.
2. Locate the filter you wish to update; click the filter's name to display the results. Be sure you are viewing the filter in the **List** view so that you see the columns.
3. Configure the column order as desired by clicking on the column name and dragging it to the new position. Your changes are saved and will be displayed the next time you view this filter.

**To remove a filter's saved column layout:**

1. Click the **My** tab on the 'Manage Filters' page.
2. Locate the filter you wish to update; click the filter's name to display the results. Be sure you are viewing the filter in the **List** view so that you see the columns.
3. Click the **Columns** option on the top right of the displayed columns, and select **Restore Defaults** in the displayed window.

#### Exporting column ordered issues

When the results of a saved filter are exported to Excel, the column order and choice of columns are those that were saved with the filter. Even if a user has configured a personal column order for the results on the screen, the **saved configuration** is used for the Excel export. To export using your own configuration, save a copy of the filter along with your configuration, and then export the results to Excel.

### Subscribing to a filter

See [Working with search results][5].

## Managing other user's shared filters

A **shared filter**  is a filter whose creator has shared that filter with other users. Refer to  [Sharing a filter][10] above for details. When a shared filter is created by a user, that user:

- Initially 'owns' the shared filter.
- Being the owner, can edit and modify the shared filter.

If you have the **Jira Administrators**  global permission, you can manage shared filters that were created by other users. For instructions, see  [Managing shared filters][11].

## Next steps

Read the following related topics:

- [Searching for issues][3]
- [Basic searching][12]
- [Advanced searching][13]
- [Working with search results][5]

Last modified on Jul 26, 2022

Was this helpful?

Yes

Powered by [Confluence][14] and [Scroll Viewport][15].

[1]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596780/1488596781/1/1649875414412/SaveSearchAsFilter.png
[2]: https://confluence.atlassian.com/servicemanagementserver103/files/1488596780/1488596793/1/1649859490527/manage_filters.png
[3]: https://confluence.atlassian.com/servicemanagementserver103/searching-for-issues-1488596697.html
[4]: https://confluence.atlassian.com/servicemanagementserver103/#Savingyoursearchasafilter-favorite_filters
[5]: https://confluence.atlassian.com/servicemanagementserver103/working-with-search-results-1488596842.html
[6]: https://confluence.atlassian.com/servicemanagementserver103/adding-and-customizing-gadgets-1488597070.html
[7]: https://confluence.atlassian.com/servicemanagementserver103/#Savingyoursearchasafilter-clone
[8]: https://confluence.atlassian.com/servicemanagementserver103/#Savingyoursearchasafilter-otheruserssharedfilters
[9]: https://confluence.atlassian.com/servicemanagementserver103/#
[10]: https://confluence.atlassian.com/servicemanagementserver103/#Savingyoursearchasafilter-sharing_filters
[11]: https://confluence.atlassian.com/adminjiraserver073/managing-shared-filters-861254012.html
[12]: https://confluence.atlassian.com/servicemanagementserver103/basic-searching-1488596727.html
[13]: https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-1488596757.html
[14]: http://www.atlassian.com/
[15]: https://www.k15t.com/go/scroll-viewport
