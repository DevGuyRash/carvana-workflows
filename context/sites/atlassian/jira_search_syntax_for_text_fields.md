---
title: "Search syntax for text fields | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/search-syntax-for-text-fields-1488596778.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
This page provides information on the syntax for searching text fields, which can be done in the quick search, basic search, and advanced search.

Text searches can be done in the advanced search when the [CONTAINS (~) operator](https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-operators-reference-1488596776.html#Advancedsearchingoperatorsreference-CONTAINS) is used, e.g. `summary~"windows*"`. It can also be done in quick search and basic search when searching on supported fields.

*Acknowledgments: Jira uses Apache Lucene for text indexing, which provides a rich query language. Much of the information on this page is derived from the [Query Parser Syntax](https://lucene.apache.org/core/2_9_4/queryparsersyntax.html) page of the Lucene documentation.*

## Query terms

A query is broken up into **terms**  and  **operators.** There are two types of terms: **Single Terms**  and  **Phrases**.

A **Single Term**  is a single word, such as " `test` " or " `hello` ".

A **Phrase**  is a group of words surrounded by double quotes, such as " `hello dolly` ".

Multiple terms can be combined together with Boolean operators to form a more complex query (see below). If you combine multiple terms without specifying any Boolean operators, they will be joined using AND operators.

*Note: All query terms in Jira are not case sensitive.*

## Term modifiers

Jira supports modifying query terms to provide a wide range of searching options.

[Exact searches (phrases)](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-exactexactsearchesExactsearches\(phrases\)) | [Wildcard searches:? and \*](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-wildcardsWildcardsearches:?and*) | [Fuzzy searches: ~](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-fuzzyFuzzysearches:~) | [Prefix and Suffix search](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-prefsufPrefixandSuffixsearch) | [Proximity searches](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-Proximitysearches)

### Exact searches (phrases)

To find exact matches for **phrases**, for example *Jira Software*, you need to enclose the whole phrase in quote-marks ("). Otherwise, the search will return all issues that contain both words in no particular order - this would include *Jira Software*, but also *Jira is the best software!.*

If you’re using advanced search, you need to additionally escape each of the quote-marks with a backslash (\\). For details, see the examples below or find your field in [Advanced search - field reference](https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-fields-reference-1488596774.html).

**Examples**

- **Basic search:** Find all issues that contain the phrase *Jira Software*:
	```
	Just type "Jira Software" into the search field.
	```
- **Advanced search:** Find all issues that contain the words *Jira* and *Software*, in no particular order.
	```
	text ~ "Jira Software"
	```
- **Advanced search:** Find all issues that contain the phrase *Jira Software*.
	```
	text ~ "\"Jira Software\""
	```
- **Advanced search:** Find all issues that contain the URL `https://atlassian.com`:
	```
	text ~ "\"https://atlassian.com\""
	```

As you can see in the two preceding examples, the query contains two pairs of quote-marks. The external ones are needed to meet the JQL rules and aren’t related to your search query. The same pair of quote-marks would be automatically added by Jira in the basic search after running your search.

#### Using special characters to create phrases

In previous versions of Jira, you could use some special characters to combine **terms** into **phrases**, for example *Jira+Software* or *Jira/Software*. This is no longer the case, as the mechanism used for searching has changed and the special characters surrounding **terms** are ignored.

### Wildcard searches:? and \*

Jira supports single and multiple character wildcard searches.

To perform a single character wildcard search, use the "`?`" symbol.

To perform a multiple character wildcard search, use the " `*` " symbol.

Wildcard characters need to be enclosed in quote-marks, as they are reserved characters in advanced search. Use quotations, e.g. `summary ~ "cha?k and che*"`

The single character wildcard search looks for terms that match that with the single character replaced. For example, to search for " `text` " or " `test` ", you can use the search:

```
te?t
```

Multiple character wildcard searches looks for 0 or more characters. For example, to search for `Windows`, `Win95`, or `WindowsNT`, you can use the search:

```
win*
```

You can also use the wildcard searches in the middle of a term. For example, to search for `Win95` or `Windows95`, you can use the search:

```
wi*95
```

### Fuzzy searches: ~

Jira supports fuzzy searches. To do a fuzzy search, use the tilde, "~", symbol at the end of a single word term. For example, to search for a term similar in spelling to " `roam` ", use the fuzzy search:

```
roam~
```

This search will find terms like foam and roams.

*Note: Terms found by the fuzzy search will automatically get a boost factor of 0.2.*

### Prefix and Suffix search

Jira supports searching for parts of the words. To perform such search, include either a prefix or a suffix of the word or phrase you're looking for. For example to look for a MagicBox issue, you can use either of the two search patterns:

  

Prefix search

```
summary ~ "magic*"
```

Suffix search

```
summary ~ "*box"
```

  

### Proximity searches

Jira supports finding words that are within a specific distance away. To do a proximity search, use the tilde, "~", symbol at the end of a phrase. For example, to search for " `atlassian` " and " `Jira` " within 10 words of each other in a document, use the search:

```
"atlassian Jira"~10
```

## Boosting a term: ^

Jira provides the relevance level of matching documents based on the terms found. To boost a term, use the caret, "^", symbol with a boost factor (a number) at the end of the term you are searching. The higher the boost factor, the more relevant the term will be.

Boosting allows you to control the relevance of a document by boosting its term. For example, if you are searching for

```
atlassian Jira
```

and you want the term " `atlassian` " to be more relevant, boost it using the ^ symbol along with the boost factor next to the term. You would type:

```
atlassian^4 Jira
```

This will make documents with the term atlassian appear more relevant. You can also boost Phrase Terms, as in the example:

```
"atlassian Jira"^4 querying
```

By default, the boost factor is 1. Although, the boost factor must be positive, it can be less than 1 (i.e. 0.2).

## Boolean operators

Boolean operators allow terms to be combined through logic operators. Jira supports AND, "+", OR, NOT and "-" as Boolean operators.

Boolean operators must be ALL CAPS.

[AND](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-AND) | [OR](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-OR) | [Required term: +](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-Requiredterm:+) | [NOT](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-NOT) | [Excluded term: -](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-Excludedterm:-)

### AND

The AND operator is the default conjunction operator. This means that if there is no Boolean operator between two terms, the AND operator is used. The AND operator matches documents where both terms exist anywhere in the text of a single document. This is equivalent to an intersection using sets. The symbol `&&` can be used in place of the word AND.

To search for documents that contain " `atlassian Jira` " and " `issue tracking` ", use the query:

```
"atlassian Jira" AND "issue tracking"
```

### OR

The OR operator links two terms, and finds a matching document if either of the terms exist in a document. This is equivalent to a union using sets. The symbol `||` can be used in place of the word OR.

To search for documents that contain either " `atlassian Jira` " or just " `confluence` ", use the query:

```
"atlassian Jira" || confluence
```

or

```
"atlassian Jira" OR confluence
```

### Required term: +

The "+" or required operator requires that the term after the "+" symbol exists somewhere in the field of a single document.

To search for documents that must contain " `Jira` " and may contain " `atlassian` ", use the query:

```
+Jira atlassian
```

### NOT

The NOT operator excludes documents that contain the term after NOT. This is equivalent to a difference using sets. The symbol `!` can be used in place of the word NOT.

To search for documents that contain " `atlassian Jira` " but not " `japan` ", use the query:

```
"atlassian Jira" NOT "japan"
```

*Note: The NOT operator cannot be used with just one term. For example, the following search will return no results:*

```
NOT "atlassian Jira"
```

Usage of the **NOT** operator over multiple fields may return results that include the specified excluded term. This is due to the fact that the search query is executed over each field in turn, and the result set for each field is combined to form the final result set. Hence, an issue that matches the search query based on one field, but fails based on another field will be included in the search result set.

### Excluded term: -

The " `-` " or prohibit operator excludes documents that contain the term after the " `-` " symbol.

To search for documents that contain " `atlassian Jira` " but not " `japan` ", use the query:

```
"atlassian Jira" -japan
```

## Grouping

Jira supports using parentheses to group clauses to form sub queries. This can be very useful if you want to control the boolean logic for a query.

To search for `bugs`  and either  `atlassian`  or  `Jira`, use the query:

```
bugs AND (atlassian OR Jira)
```

This eliminates any confusion and makes sure that `bugs`  must exist, and either term  `atlassian`  or  `Jira` may exist.

Do not use the grouping character '(' at the start of a search query, as this will result in an error. For example, `"(atlassian OR Jira) AND bugs"` will not work.

## Special characters

```
+ - & | ! ( ) { } [ ] ^ ~ * ? \ :
```

Special characters aren’t stored in the index, which means you can’t search for them. The index only keeps text and numbers, so searching for `"\\[Jira Software\\]"` and `"Jira Software"` will have the same effect — escaped special characters (`[]`) won’t be included in the search.

In previous Jira versions, you could use special characters to combine two separate terms into a phrase, for example `"Jira+Software"` or `"Jira/Software"`. This doesn’t apply to Jira 8.x. If you’d like to search for phrases, see [Exact searches (phrases)](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-exactsearches).

## Reserved words

To keep the search index size and search performance optimal in Jira, the following English *reserved words*  (also known as ' *stop words* ') are ignored from the search index and hence, Jira's text search features:

`"a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "this", "to", "was", "will", "with"`

Be aware that this can sometimes lead to unexpected results. For example, suppose one issue contains the text phrase "VSX will crash" and another issue contains the phrase "VSX will not crash". A text search for "VSX will crash" will return both of these issues. This is because the words `will`  and  `not` are part of the reserved words list.

Your Jira administrator can make Jira index these reserved words (so that Jira will find issues based on the presence of these words) by changing the **Indexing Language**  to  **Other**  (under  **Administration > System > General Configuration**).

## Word stemming

Since Jira cannot search for issues containing parts of words (see [below](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-limitations)), word 'stemming' allows you to retrieve issues from a search based on the 'root' (or 'stem') forms of words instead of requiring an exact match with specific forms of these words. The number of issues retrieved from a search based on a stemmed word is typically larger, since any other issues containing words that are stemmed back to the same root will also be retrieved in the search results.

For example, if you search for issues using the query term 'customize' on the Summary field, Jira stems this word to its root form 'custom', and will retrieve all issues whose Summary field also contains any word that can be stemmed back to 'custom'. Hence, the following query:

```
summary ~ "customize"
```

will retrieve issues whose Summary field contains the following words:

- customized
- customizing
- customs
- customer
- etc.

**Please Note:**

- Your Jira administrator can disable word stemming (so that Jira will find issues based on exact matches with words) by changing the **Indexing Language**  to  **Other**  (under  **Administration > System > General Configuration**).
- Word stemming applies to *all* Jira fields (as well as text fields).
- When Jira indexes its fields, any words that are 'stemmed' are stored in Jira's search index in root form only.

## Limitations

Please note that the following limitations apply to Jira's search:

### Whole words only

Jira cannot search for issues containing parts of words but on whole words only. The exception to this are words which are [stemmed](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-stemming).

This limitation can also be overcome using [fuzzy searches](https://confluence.atlassian.com/servicemanagementserver103/#Searchsyntaxfortextfields-fuzzy).

## Next steps

Read the following related topics:

- [Searching for issues](https://confluence.atlassian.com/servicemanagementserver103/searching-for-issues-1488596697.html)
- [Quick searching](https://confluence.atlassian.com/servicemanagementserver103/quick-searching-1488596750.html)
- [Basic searching](https://confluence.atlassian.com/servicemanagementserver103/basic-searching-1488596727.html)
- [Advanced searching](https://confluence.atlassian.com/servicemanagementserver103/advanced-searching-1488596757.html)

Last modified on Sep 19, 2023

Was this helpful?

Yes

Powered by [Confluence](http://www.atlassian.com/) and [Scroll Viewport](https://www.k15t.com/go/scroll-viewport).