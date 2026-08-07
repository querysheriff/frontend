// Documentation shown in the right-side panel, keyed by the card's doc id.
// Each entry explains what a card's data means, why it's the right metric to
// look at, and how it's produced under the hood.

export type DocLink = { label: string; href: string };
// A block is a paragraph (string) or a bullet list. Inline `code` spans in any
// string are wrapped in backticks and rendered as code by the drawer.
export type DocBlock = string | { list: string[] };
export type DocSection = { heading: string; body: DocBlock[]; link?: DocLink };
export type DocEntry = { title: string; sections: DocSection[] };

export const docContent: Record<string, DocEntry> = {
	'q-volume': {
		title: 'Query volume over time',
		sections: [
			{
				heading: 'What this chart shows',
				body: [
					'This chart shows how many database queries ran over time.',
					'A query is any request the application sends to PostgreSQL, such as reading data, updating a record, or deleting something. Each bar shows the total number of queries during a specific time period.',
					'A taller bar means more queries ran during that period, which usually means the database was under more load.'
				]
			},
			{
				heading: 'Why this matters',
				body: [
					'The number of queries can help explain why the application felt slow at a certain time.',
					'When many queries run at the same time, they compete for database resources such as CPU, memory, and disk access. This can cause queries to take longer and may slow down the application.',
					'Large spikes or sudden drops are worth checking. A spike may be caused by:',
					{
						list: [
							'A scheduled task or cron job',
							'A sudden increase in users',
							'A bug that sends too many queries, like an N+1 problem',
							'A DDoS attack'
						]
					}
				]
			},
			{
				heading: 'How the chart works',
				body: [
					'PostgreSQL provides the `pg_stat_statements` extension, which keeps a total count of how many times each query has been executed.',
					'The collector reads these counters every minute. It compares the latest values with the previous values to calculate how many queries ran during that one-minute period. The backend then stores these results.',
					'The chart groups the stored values into equal time intervals, with one bar for each interval.',
					'When you select a wider time range, each bar represents a longer period of time. This keeps the chart readable instead of showing too many small bars.',
					'Because the collector reads the counters once per minute, the smallest available interval is one minute.'
				]
			}
		]
	},

	'q-speed': {
		title: 'Query speed over time',
		sections: [
			{
				heading: 'What this chart shows',
				body: [
					'This chart shows how long database queries took to complete over time.',
					'It uses three percentile lines:',
					{
						list: [
							'**p90**: 9 out of 10 queries finished faster than this value',
							'**p95**: 19 out of 20 queries finished faster than this value',
							'**p99**: 99 out of 100 queries finished faster than this value'
						]
					},
					'When a line goes up, queries are taking longer. A large gap between p90 and p99 means most queries are fast, but a small number are much slower.'
				]
			},
			{
				heading: 'Why this matters',
				body: [
					'These lines show both how fast queries are and how consistent their performance is.',
					'They are often more useful than an average because a few very slow queries may not change the average much. Percentiles make those slower queries easier to notice.',
					'High or rising values may be caused by:',
					{
						list: [
							'A missing index',
							'Queries reading large amounts of data from disk',
							'Queries waiting for locks',
							'High CPU or memory usage'
						]
					}
				]
			},
			{
				heading: 'How the chart works',
				body: [
					'PostgreSQL provides the `pg_stat_statements` extension, which keeps a total count of how many times each query has been executed and how much time was spent running it.',
					'The collector reads these counters every minute. It compares the latest values with the previous values to calculate how many times each query ran and how much time it used during that one-minute period. The backend then stores these results.',
					'Because PostgreSQL does not store the duration of every individual query run, the backend estimates the percentiles. It calculates an average time for each query and gives more weight to queries that ran more often.',
					'For example, when a query runs 20 times with an average time of 400 ms, the calculation treats this as 20 query runs of 400 ms.',
					'The chart groups these results into equal time intervals and calculates the estimated p90, p95, and p99 values for each interval.',
					'Utility statements such as `BEGIN`, `COMMIT`, and `SET` are excluded from these percentiles. They run extremely often and finish almost instantly, so counting them would pull the numbers down and hide the real speed of read and write queries.',
					'Lower percentiles such as p75 are also not shown, so the chart stays focused on the slower queries that matter most.'
				]
			}
		]
	},

	'q-table': {
		title: 'Queries',
		sections: [
			{
				heading: 'What this table shows',
				body: [
					'This table lists the normalized queries that ran during the selected time range and summarizes how they performed.',
					'A normalized query is a query where changing values are replaced with placeholders, so queries with the same SQL structure can be grouped together.',
					'For example:',
					'`SELECT * FROM users WHERE id = 10`',
					'and',
					'`SELECT * FROM users WHERE id = 25`',
					'are recorded as one normalized query:',
					'`SELECT * FROM users WHERE id = $1`',
					'The `$1` placeholder means that different values were used when the query ran. Each row in the table represents one normalized query recorded by PostgreSQL.',
					'Tags can also be collected from individual query samples. For example, the query comment `/* service=payment-api */` adds the tag `service=payment-api`.',
					'A tag is shown on the normalized query only when it has the same value across all its samples. Tags that change for every sample, such as `request_id`, remain available only on the individual sample.',
					'The columns are:',
					{
						list: [
							'**Query**: The normalized SQL statement preview.',
							'**User**: The database user that executed the query.',
							'**Avg**: The average time one execution of the query took.',
							'**Calls**: The number of times the query was executed.',
							'**Rows/Call**: The average number of rows returned or changed by each execution.',
							'**% IO**: The percentage of total disk time used by this query. For example, 20% means it was responsible for 20% of the time all queries spent reading from or writing to disk.',
							'**% Time**: The percentage of total query time used by this query. For example, 20% means it was responsible for 20% of the time spent running all queries.'
						]
					}
				]
			},
			{
				heading: 'Why this matters',
				body: [
					'This table helps you identify which queries are most worth improving.',
					'You can sort the table by any column. Sorting by **% Time** is often the most useful because it shows which queries use the most database time overall.',
					'The query with the highest average time is not always the biggest problem. For example, a query that takes 50 ms but runs millions of times may use much more database time than a query that takes 5 seconds but runs only twice.',
					'Useful things to look for include:',
					{
						list: [
							'**High % Time**: Queries that use the most database time overall',
							'**High Avg**: Queries that are slow each time they run',
							'**High Calls**: Frequently executed queries where even a small improvement can have a large effect',
							'**High Rows/Call**: Queries that return or change many rows each time they run, which may mean they are fetching more data than needed',
							'**High % IO**: Queries that spend a large amount of time accessing disk and may benefit from an index or other optimization'
						]
					}
				]
			},
			{
				heading: 'How the table works',
				body: [
					'PostgreSQL provides the `pg_stat_statements` extension, which keeps totals for each query. These totals include how many times the query was executed, how much time it used, how many rows it processed, and how much time was spent reading from or writing to disk.',
					'The collector reads these counters every minute. It compares the latest values with the previous values to calculate what happened during that one-minute period. The backend then stores these results.',
					'For the selected time range, the backend adds together the stored values for each query and uses them to calculate the averages and percentages shown in the table.',
					'To investigate a specific query in more detail, open it from the table.'
				]
			}
		]
	},

	'qd-volume': {
		title: 'Query volume over time',
		sections: [
			{
				heading: 'What this chart shows',
				body: [
					'This chart shows how many times this specific query ran over time.',
					'It works exactly the same as the Query volume over time chart on the Queries page, and reads the same PostgreSQL counters in the same way. The only difference is that it counts this one query instead of all queries.'
				]
			}
		]
	},

	'qd-speed': {
		title: 'Query speed over time',
		sections: [
			{
				heading: 'What this chart shows',
				body: [
					'This chart shows how long this specific query took to run over time. It uses two lines:',
					{
						list: [
							'**avg total**: the average time one run of the query took',
							'**avg IO**: the average part of that time spent reading from or writing to disk'
						]
					},
					'IO (input/output) is disk access, which is much slower than memory, so it is often where a slow query loses time. The gap between the lines is everything else, such as CPU work or waiting for locks.'
				]
			},
			{
				heading: 'Why this matters',
				body: [
					'It tells you whether this query is getting slower, and the avg IO line helps explain why. A query that spends most of its time on disk usually reads a lot of data and may benefit from an index.',
					'This chart uses an average, not the p90, p95, and p99 percentiles from the Queries page. Those percentiles are estimated by combining many queries, and a single query does not have enough data to estimate them well.'
				]
			},
			{
				heading: 'How the chart works',
				body: [
					'Like the other charts, the values come from PostgreSQL’s `pg_stat_statements` extension, read every minute and compared with the previous values.',
					'For each interval, avg total is the total time divided by the number of runs, and avg IO is the total disk time divided by the number of runs. Disk time is only measured when `track_io_timing` is turned on.'
				]
			}
		]
	},

	'qd-query': {
		title: 'Query',
		sections: [
			{
				heading: 'What this shows',
				body: [
					'The normalized query: one entry stands for every run of the same shape, with the real values replaced by placeholders like `$1`.',
					'That is why this text has no values in it. The captured samples below show real runs.'
				]
			},
			{
				heading: 'Why this matters',
				body: [
					'Normalizing is what lets PostgreSQL group thousands of runs into one row, so the totals and averages on this page describe the query as a whole rather than one execution.'
				]
			}
		]
	},

	'qd-samples': {
		title: 'Captured samples',
		sections: [
			{
				heading: 'What this table shows',
				body: [
					'This table shows individual runs of this query, with the real values each one used. Unlike the normalized query above, each row here is one actual execution.',
					'The columns are:',
					{
						list: [
							'**At**: When the query ran.',
							'**Query**: The full query text, with the real values used in that run.',
							'**Plan**: The execution plan for that run, when one was captured. It shows the steps PostgreSQL took to run the query.',
							'**Duration**: How long that run took.'
						]
					}
				]
			},
			{
				heading: 'Why this matters',
				body: [
					'The charts tell you a query is slow on average. A sample shows which real values were slow, so you can reproduce it.',
					'The plan is the most useful part. It shows exactly how PostgreSQL ran the query and is the best way to spot a missing index or a bad row estimate.'
				]
			},
			{
				heading: 'How the table works',
				body: [
					'These samples come from the PostgreSQL logs, not from the counters the charts use.',
					'PostgreSQL logs slow queries when `log_min_duration_statement` is set, and the `auto_explain` extension adds the execution plan. The collector reads these log entries and the backend stores them here.',
					'Because only slow queries are logged, this is a sample of runs, not every execution.'
				]
			}
		]
	}
};
