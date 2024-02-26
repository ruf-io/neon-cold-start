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

### Run recurrently

You can configure AWS to schedule a benchmark every 30 minutes. This will generate enough datapoints throughout the day to analyze the average time for cold starts.

<details>
<summary>Code</summary>
<br>

```bash

# 1. Load the environment variables:
source .env

# 2. Zip the code:
zip -j lambda.zip ./setup/index.js && zip -rq lambda.zip node_modules -x "*next*" -x "typescript" -x "*chartjs*"

# 3. Create a role and attach the policy:
ROLE_ARN=$(aws iam create-role --role-name neon-benchmark-lambda-execute-role --assume-role-policy-document file://setup/trust-policy.json --query 'Role.Arn' --output text)
aws iam attach-role-policy --role-name neon-benchmark-lambda-execute-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 4. Upload the lambda code:
LAMBDA_ARN=$(aws lambda create-function --function-name BenchmarkRunner --runtime nodejs20.x --role $ROLE_ARN --handler index.handler --timeout 120 --zip-file fileb://lambda.zip --query 'FunctionArn' --output text --environment Variables={API_KEY=$API_KEY})

# 5. Schedule every 30 minutes:
aws scheduler create-schedule \
    --name NeonColdBenchmarkScheduler \
    --schedule-expression "cron(0/30 * * * ? *)" \
    --target "{\"RoleArn\": \"$ROLE_ARN\", \"Arn\":\"$LAMBDA_ARN\" }" \
    --flexible-time-window '{ "Mode": "FLEXIBLE", "MaximumWindowInMinutes": 15}'
```
</details>

## The problem
Neon suspends the database compute to save resources after five minutes of inactivity. The next time the database needs to process a query, the compute will need to resume. This is known as the cold-start problem. Understanding how much time takes the cold-start is the idea for this project.

## Benchmark

The application will run query all the benchmarks done and calculate basic metrics (avg, max, min). This will give you an overview on how much cold starts are taking. The benchmark will suspend your branch compute and request a simple read query over an indexed table:

```sql
-- From the setup step:
CREATE TABLE IF NOT EXISTS series (serie_num INT);
INSERT INTO series VALUES (generate_series(0, 100000));
CREATE INDEX IF NOT EXISTS series_idx ON series (serie_num);

-- Benchmark query:
SELECT * FROM series WHERE serie_num = 1000000;
```

After the benchmark, the result is stored in a table:

```sql
CREATE TABLE IF NOT EXISTS benchmarks (id TEXT, duration INT, ts TIMESTAMP);
```

## Learn More

- [Neon Documentation](https://neon.tech/docs/introduction).
- [Cold starts](https://neon.tech/blog/cold-starts-just-got-hot).

Your feedback and contributions are welcome!