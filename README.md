This is a [Neon](http://neon.tech) tool to benchmark cold starts.

## Getting Started

1. Install the dependencies:
    ```bash
    npm install
    ```
2. Create an `.env` file using `.env.example` as template.
3. Setup the benchmark:
    ```bash
    # Add the output to the .env file
    npm run setup
    ```
4. Run a single benchmark:
    ```bash
    npm run benchmark
    ```
5. Run the development server:
    ```bash
    npm run serve
    ```
6. Open [http://localhost:3000](http://localhost:3000) with your browser to view the results. 

### Setup a cron

Configure AWS to schedule a benchmark every 30 minutes. This will generate enough datapoints throughout the day to analyze the average time for cold starts.

1. Load the environment variables:
```bash
source .env
```
2. Zip the code:
```bash
zip -j lambda.zip ./setup/index.js && zip -rq lambda.zip node_modules -x "*next*" -x "*.ts" -x "*chartjs*"
```
3. Create a role:
```bash
ROLE_ARN=$(aws iam create-role --role-name neon-benchmark-lambda-execute-role --assume-role-policy-document file://setup/trust-policy.json --query 'Role.Arn' --output text)

aws iam attach-role-policy --role-name neon-benchmark-lambda-execute-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```
4. Upload the lambda code:
```bash
LAMBDA_ARN=$(aws lambda create-function --function-name BenchmarkRunner --runtime nodejs20.x --role $ROLE_ARN --handler index.handler --timeout 120 --zip-file fileb://lambda.zip --query 'FunctionArn' --output text --environment Variables={API_KEY=$API_KEY})
```
5. Schedule every 30 minutes:
```bash
aws scheduler create-schedule \
    --name NeonColdBenchmarkScheduler \
    --schedule-expression "cron(0/30 * * * ? *)" \
    --target "{\"RoleArn\": \"$ROLE_ARN\", \"Arn\":\"$LAMBDA_ARN\" }" \
    --flexible-time-window '{ "Mode": "FLEXIBLE", "MaximumWindowInMinutes": 15}'
```

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