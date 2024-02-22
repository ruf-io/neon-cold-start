This is a [Neon](http://neon.tech) tool to benchmark cold starts.

## Getting Started

1. Install the dependencies:
    ```bash
    npm install
    ```
2. Start the benchmark:
```bash
    API_KEY=""

    # Using cron.
    cron ...

    # AWS Lambda
    aws ...
```
3. Create an `.env` file using `.env.example` as template.
4. Run the development server:
    ```bash
    npm run serve
    ```
5. Open [http://localhost:3000](http://localhost:3000) with your browser to run the benchmark. Remember to keep the browser open while the benchmark is running.

## The problem
Neon suspends the database compute to save resources after five minutes of inactivity. The next time the database needs to process a query, the compute will need to resume. This is known as the cold-start problem. Understanding how much time takes the cold-start is the idea for this project.

## Benchmark

The application will read your [project operations](https://neon.tech/docs/manage/operations) and calculate basic metrics (avg, max, min). The `start_compute` operation duration reflects much of the time taken to warm a cold compute endpoint. This will give you an overview on how much cold starts are taking. The next step is to run the benchmark.

The benchmark will suspend your branch compute and request a simple read query over an indexed table:

```sql
-- Both, the setup and query are configurable at `/api/benchmark/route.ts`
-- Setup:
CREATE TABLE IF NOT EXISTS benchmark_table (A INT);
INSERT INTO benchmark_table VALUES (generate_series(0, 100000));
CREATE INDEX IF NOT EXISTS benchmark_table_idx ON benchmark_table (A);

-- Query:
SELECT * FROM benchmark_big_table WHERE a = 1000000;
```

Next, each run benchmark is stored in a table:

```sql
CREATE TABLE IF NOT EXISTS benchmarks (id TEXT, duration INT, ts TIMESTAMP);
```

The application will display the last benchmark available.

## Learn More

- [Neon Documentation](https://neon.tech/docs/introduction).
- [Cold starts](https://neon.tech/blog/cold-starts-just-got-hot).

Your feedback and contributions are welcome!