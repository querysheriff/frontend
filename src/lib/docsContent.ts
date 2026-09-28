// A block is a paragraph or a bullet list; inline `code` and **bold** spans are rendered as such.
type DocBlock = string | { list: string[] };
type DocSection = { heading: string; body: DocBlock[] };
type DocEntry = { title: string; sections: DocSection[] };

const docContent: Record<string, DocEntry> = {
	'q-volume': {
		title: 'Query volume over time',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'How many queries PostgreSQL ran over time. Each bar is one time period.',
					'A taller bar means more database work during that period.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'Spikes or sudden drops are worth checking. Common causes include:',
					{
						list: [
							'More or less application traffic',
							'A scheduled job',
							'A bug sending too many queries, such as N+1',
							'Abusive or unexpected traffic'
						]
					}
				]
			},
			{
				heading: 'How it works',
				body: [
					'`pg_stat_statements` keeps running query counters. QuerySheriff reads them every minute and stores what changed since the previous check.',
					'Wider time ranges use larger buckets so the chart stays readable.'
				]
			}
		]
	},

	'q-speed': {
		title: 'Query speed over time',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'Estimated query latency over time:',
					{
						list: [
							'**p90**: 90% of queries finished at or below this time',
							'**p95**: 95% finished at or below this time',
							'**p99**: 99% finished at or below this time'
						]
					},
					'Rising lines mean queries are getting slower. A large p90–p99 gap means a small group is much slower than the rest.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'Percentiles make slow outliers easier to see than a simple average.',
					'High values can come from missing indexes, heavy disk reads, lock waits, or CPU pressure.'
				]
			},
			{
				heading: 'How it works',
				body: [
					'`pg_stat_statements` does not keep every individual query duration, so these percentiles are estimated from each query’s average time and call count.',
					'Utility commands and queries averaging under 10 ms are excluded so very fast work does not hide slower queries.',
					'Use this chart mainly for trends, not exact per-request latency.'
				]
			}
		]
	},

	'q-table': {
		title: 'Queries',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'One row per normalized query that ran during the selected time range.',
					'Normalized means values are replaced with placeholders. For example, `id = 10` and `id = 25` become `id = $1`, so PostgreSQL can group them together.',
					'Tags from the latest captured sample are shown on the normalized query.',
					{
						list: [
							'**Query**: normalized SQL',
							'**User**: database user',
							'**Avg**: average time per run',
							'**Calls**: number of runs',
							'**Rows/Call**: average rows returned or changed',
							'**% IO**: share of all query IO time',
							'**% Time**: share of all query runtime'
						]
					}
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'This is the fastest way to find queries worth improving. Sorting by **% Time** is usually a good start.',
					'A 50 ms query running a million times can matter more than a 5 second query running twice.',
					{
						list: [
							'**High % Time**: biggest overall cost',
							'**High Avg**: slow each time',
							'**High Calls**: runs very often',
							'**High Rows/Call**: handles lots of rows',
							'**High % IO**: spends lots of time on disk'
						]
					}
				]
			},
			{
				heading: 'How it works',
				body: [
					'QuerySheriff reads `pg_stat_statements` every minute and stores the changes in its counters.',
					'The selected time range is then combined into the totals, averages, and percentages shown here.',
					'Open a query to investigate it in more detail.'
				]
			}
		]
	},

	'qd-volume': {
		title: 'Query volume over time',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'How many times this query ran over time.',
					'It works like the volume chart on the Queries page, but only counts this query.'
				]
			}
		]
	},

	'qd-speed': {
		title: 'Query speed over time',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'How long this query took over time:',
					{
						list: [
							'**avg total**: average time per run',
							'**avg IO**: average time spent reading from or writing to disk'
						]
					},
					'The gap between the lines is other work, such as CPU time or waiting.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'It shows whether this query is getting slower and whether disk IO is a large part of that time.',
					'High IO can mean the query reads a lot of data and may be worth checking for better indexes or a better query plan.'
				]
			},
			{
				heading: 'How it works',
				body: [
					'The values come from `pg_stat_statements` counters sampled every minute.',
					'IO time is available only when PostgreSQL `track_io_timing` is enabled.'
				]
			}
		]
	},

	'qd-query': {
		title: 'Query',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'The normalized query. Real values are replaced with placeholders like `$1`, so all runs with the same SQL shape are grouped together.',
					'Captured samples below show real executions with their actual values.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'Grouping similar runs lets the charts and totals describe the query as a whole instead of one execution.'
				]
			}
		]
	},

	'l-wait-time': {
		title: 'Lock wait time',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'How much time queries spent waiting for locks instead of running.',
					'A lock wait happens when one transaction holds something another query needs.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'A spike means queries were blocked. This can make an application feel frozen even when the queries themselves are normally fast.',
					'Ideally this stays near zero. Check the table below when it spikes.'
				]
			},
			{
				heading: 'How it works',
				body: [
					'QuerySheriff checks lock waits once per second.',
					'Very short waits between checks may not be captured.'
				]
			}
		]
	},

	'l-waits': {
		title: 'Lock waits',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'Each row shows a blocked query and the session blocking it. Longest waits come first.',
					{
						list: [
							'**Started**: when the wait began',
							'**Waited**: how long it was blocked',
							'**Waiting query**: the blocked query',
							'**Blocking query**: the query seen in the blocking session',
							'**Lock**: what kind of lock it waited for'
						]
					},
					'Hover a query to see more details such as its full captured text, PID, and application.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'Usually the blocking side is the one worth investigating.',
					'If the same blocker appears many times, one transaction may be holding up a large part of the application.'
				]
			},
			{
				heading: 'How it works',
				body: [
					'`pg_stat_activity` is checked once per second and repeated samples of the same wait are joined together.',
					'PostgreSQL does not keep the exact statement that originally took a lock. The blocking query shown is what that session was running when QuerySheriff first saw the wait.',
					'`not captured` means the blocking session was not seen. PostgreSQL background processes such as autovacuum are not collected here.'
				]
			}
		]
	},

	't-age': {
		title: 'Oldest open transaction',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'The age of the oldest open transaction at each moment.',
					'A rising line means a transaction is staying open. A drop usually means it finished.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'Long transactions can hold locks and block PostgreSQL from cleaning up old row versions.',
					'Over time this can cause table or index bloat. Transactions open for minutes are usually worth checking.'
				]
			},
			{
				heading: 'How it works',
				body: [
					'Once per second, QuerySheriff checks all open transactions and records the age of the oldest one.',
					'When it finishes, the line drops to the next-oldest transaction or zero.'
				]
			}
		]
	},

	't-longest': {
		title: 'Long transactions',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'Transactions that stayed open for at least 5 seconds, longest first.',
					{
						list: [
							'**Started**: when it began',
							'**Open**: how long it stayed open',
							'**PID**: PostgreSQL process ID',
							'**Application**: client application name'
						]
					},
					'Open a row to see what the transaction was doing over time.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'Long **IDLE** periods usually mean PostgreSQL was waiting for the application to send the next command.',
					'Long **ACTIVE** periods mean a query was running. Check that query in the Queries section.',
					'**ABORTED** means a statement failed but the transaction was left open.'
				]
			},
			{
				heading: 'How it works',
				body: [
					'Transaction activity is checked once per second and matching samples are joined into steps.',
					'Very short activity between checks may not be captured.'
				]
			}
		]
	},

	'qd-samples': {
		title: 'Captured samples',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'Real executions of this query, including the values used in each run.',
					{
						list: [
							'**At**: when it ran',
							'**Query**: captured SQL with real values',
							'**Plan**: how PostgreSQL executed it, when available',
							'**Duration**: how long it took'
						]
					}
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'Samples help you reproduce a slow run instead of only looking at averages.',
					'The execution plan is especially useful for spotting missing indexes, bad row estimates, or expensive operations.'
				]
			},
			{
				heading: 'How it works',
				body: [
					'Samples come from PostgreSQL logs. `log_min_duration_statement` can log slow queries, and `auto_explain` can add their plans.',
					'Only queries that PostgreSQL logs can appear here, so this is not necessarily every execution.'
				]
			}
		]
	},

	'lg-severity': {
		title: 'Log severity over time',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'PostgreSQL log events grouped by severity and time.',
					'Empty means no events. Darker cells mean more events. Hover a cell for the exact count.',
					'Each row has its own scale, so rare serious events stay visible.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'It quickly shows when important database problems happened.',
					'`ERROR` usually means an operation failed, `FATAL` means a connection was terminated, and `PANIC` is a serious PostgreSQL failure.',
					'Check serious spikes, then open the logs below for details.'
				]
			}
		]
	},

	'lg-categories': {
		title: 'Log categories over time',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'Log events grouped by what happened instead of how serious it was.',
					'Darker cells mean more events. Hover a cell for the total and event breakdown.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'Severity tells you how bad something was. Category tells you which part of PostgreSQL it came from.',
					{
						list: [
							'**Server**: startup, shutdown, crashes, memory, temp files',
							'**Connection**: connections, login failures, connection limits',
							'**WAL & Checkpoint**: checkpoints and WAL archiving',
							'**Autovacuum**: vacuum, analyze, wraparound warnings',
							'**Lock**: waits, timeouts, deadlocks',
							'**Statement**: slow or cancelled queries and plans',
							'**Standby Server**: replication and recovery',
							'**Constraint Violation**: unique, foreign key, not-null, and similar failures',
							'**Application Error**: bad SQL, missing objects, permissions, and similar mistakes'
						]
					}
				]
			},
			{
				heading: 'How it works',
				body: [
					'QuerySheriff matches each PostgreSQL log message to an event type and category.',
					'Each row has its own intensity scale.'
				]
			}
		]
	},

	'lg-table': {
		title: 'Log events',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'PostgreSQL log events from the selected time range, newest first.',
					'**Event** gives each message a simpler name. Open a row to see the full message and details.',
					'Slow-query events can also link to the query and execution plan.'
				]
			},
			{
				heading: 'Why it matters',
				body: [
					'Some problems only show up in PostgreSQL logs, such as deadlocks, failed connections, constraint errors, and checkpoint warnings.',
					'Use the filters to narrow the list. Expanded rows also show the **SQLSTATE** error code when PostgreSQL provides one.'
				]
			},
			{
				heading: 'How it works',
				body: [
					'QuerySheriff reads new PostgreSQL log entries shortly after they are written.',
					'Only events enabled by PostgreSQL logging can appear here.',
					'Logs belong to the whole PostgreSQL server, so there is no database selector on this page.'
				]
			}
		]
	},

	// Mirrors the alert catalog in backend/internal/alerts/catalog.go.
	'a-alerts': {
		title: 'Alerts',
		sections: [
			{
				heading: 'What it shows',
				body: [
					'Every alert QuerySheriff can send to Slack for this server, and whether it is enabled.',
					{
						list: [
							'**Monitoring stopped**: no data received for 10 minutes',
							'**Database crashed**: PostgreSQL logged a `PANIC`',
							'**Query blocked by a lock**: waiting on a lock for 10 seconds',
							'**Query running too long**: running for 1 minute',
							'**Transaction open too long**: open for 10 minutes'
						]
					},
					'Query, lock, and transaction alerts include useful query details and SQL for terminating the session.',
					'**Weekly report** arrives Monday at 08:00 UTC with the 10 busiest queries from the previous week.'
				]
			}
		]
	}
};

/** A card repeated per server takes a `<base>#<instance>` id, so only the clicked one highlights. */
export const DOC_ID_SEP = '#';

export function docEntry(id: string): DocEntry | undefined {
	const sep = id.indexOf(DOC_ID_SEP);

	return docContent[sep === -1 ? id : id.slice(0, sep)];
}
