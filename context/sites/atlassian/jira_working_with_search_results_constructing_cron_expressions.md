---
title: "Constructing cron expressions | Jira Service Management Data Center 10.3 | Atlassian Documentation"
source: "https://confluence.atlassian.com/servicemanagementserver103/constructing-cron-expressions-1488596852.html"
author:
published:
created: 2025-12-31
description:
tags:
  - "clippings"
---
This page describes how to construct a cron expression. Cron expressions can be used when creating a subscription to a filter, as described in Working with search results.

A cron expression gives you more control over the frequency, compared to the default schedules. For example, you could define a cron expression to notify you at 8:15 am on the second Friday of every month.

## Constructing a cron expression

A cron expression is a string of fields separated by spaces. The following table displays the fields of a cron expression, *in the order that they must be specified (from left to right)*:

|  | Second | Minute | Hour | Day-of-month | Month | Day-of-week | Year (optional) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Allowed values | `0-59` | `0-59` | `0-23` | `1-31` | `1-12 or JAN-DEC` | `1-7 or SUN-SAT` | `1970-2099` |
| Allowed special / characters | , - * | , - * | , - * | , - * /? L W C | , - * | , - * /? L C # | , - * |

Note, cron expressions are not case-sensitive.

Here is an example:

```
0 15 8 ? JAN MON 2014
```

This literally translates to 0 second, 15 minute, 8 hour, any day of the month, January, 2014.

In plain English, this represents 8:15am on every Monday during January of 2014. Note, the? character means "no particular value". In this example, we've set the Day-of-month to no particular value. We don't need to specify it, as we've specified a Day-of-week value. Read more about special characters in the next section.

More examples of cron expressions are explained in the [Examples section][1] at the bottom of this page.

## Special characters

| Special character | Usage                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ,                 | Specifies a list of values. For example, in the **Day-of-week** field, 'MON,WED,FRI' means 'every Monday, Wednesday, and Friday'.                                                                                                                                                                                                                                                                                                                                     |
| \-                | Specifies a range of values. For example, in the **Day-of-week** field, 'MON-FRI' means 'every Monday, Tuesday, Wednesday, Thursday and Friday'.                                                                                                                                                                                                                                                                                                                      |
| \*                | Specifies all possible values. For example, in the **Hour** field, '\*' means 'every hour of the day'.                                                                                                                                                                                                                                                                                                                                                                |
| /                 | Specifies increments to the given value. For example, in the **Minute** field, '0/15' means 'every 15 minutes during the hour, starting at minute zero'.                                                                                                                                                                                                                                                                                                              |
| ?                 | Specifies no particular value. This is useful when you need to specify a value for one of the two fields **Day-of-month** or **Day-of-week,** but not the other.                                                                                                                                                                                                                                                                                                      |
| L                 | Specifies the last possible value; this has different meanings depending on context. In the **Day-of-week** field, 'L' on its own means 'the last day of every week' (i.e. 'every Saturday'), or if used after another value, means 'the last xxx day of the month' (e.g. 'SATL' and '7L' both mean 'the last Saturday of the month). In the **Day-of-month** field, 'L' on its own means 'the last day of the month', or 'LW' means 'the last weekday of the month'. |
| W                 | Specifies the weekday (Monday-Friday) nearest the given day of the month. For example, '1W' means 'the nearest weekday to the 1st of the month' (note that if the 1st is a Saturday, the email will be sent on the nearest weekday *within the same month,* i.e. on Monday 3rd). 'W' can only be used when the day-of-month is a single day, not a range or list of days.                                                                                             |
| #                 | Specifies the nth occurrence of a given day of the week. For example, 'TUES#2' (or '3#2') means 'the second Tuesday of the month'.                                                                                                                                                                                                                                                                                                                                    |

## Examples

| `0 15 8 ? * *`             | Every day at 8:15 pm.                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `0 15 8 * * ?`             | Every day at 8:15 am.                                                                                                                |
| `0 * 14 * * ?`             | Every minute starting at 2:00 pm and ending at 2:59 pm, every day.                                                                   |
| `0 0/5 14 * * ?`           | Every 5 minutes starting at 2:00 pm and ending at 2:55 pm, every day.                                                                |
| `0 0/5 14,18 * * ?`        | Every 5 minutes starting at 2:00 pm and ending at 2:55 pm, AND every 5 minutes starting at 6:00 pm and ending at 6:55 pm, every day. |
| `0 0-5 14 * * ?`           | Every minute starting at 2:00 pm and ending at 2:05 pm, every day.                                                                   |
| `0 0/10 * * * ? *`         | Every 10 minutes, forever.                                                                                                           |
| `0 10,44 14 ? 3 WED`       | 2:10 pm and 2:44 pm every Wednesday in the month of March.                                                                           |
| `0 15 8 ? * MON-FRI`       | 8:15 am every Monday, Tuesday, Wednesday, Thursday, and Friday.                                                                      |
| `0 15 8 15 * ?`            | 8:15 am on the 15th day of every month.                                                                                              |
| `0 15 8 L * ?`             | 8:15 am on the last day of every month.                                                                                              |
| `0 15 8 LW * ?`            | 8:15 am on the last weekday of every month.                                                                                          |
| `0 15 8 ? * 6L`            | 8:15 am on the last Friday of every month.                                                                                           |
| `0 15 8 ? * 6#2`           | 8:15 am on the second Friday of every month.                                                                                         |
| `0 15 8 ? * 6#2 2007-2009` | 8:15 am on the second Friday of every month during the years 2007, 2008, and 2009.                                                   |

Last modified on May 16, 2025

Was this helpful?

Yes

Powered by [Confluence][2] and [Scroll Viewport][3].

[1]: https://confluence.atlassian.com/servicemanagementserver103/#Constructingcronexpressions-examples
[2]: http://www.atlassian.com/
[3]: https://www.k15t.com/go/scroll-viewport
