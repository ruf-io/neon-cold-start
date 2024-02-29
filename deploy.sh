echo "Starting deployment."

# 1. Load env. vars:
echo "(1/5) Loading env. vars."
source .env

# 2. Zip the code:
echo "(2/5) Building zip."
zip -j lambda.zip ./setup/index.js && zip -rq lambda.zip node_modules -x "*next*" -x "typescript" -x "*chartjs*"

# 3. Create a role and attach the policy:
echo "(3/5) Creating role and attaching policies."
ROLE_ARN=$(aws iam create-role --role-name neon-benchmark-lambda-execute-role --assume-role-policy-document file://setup/trust-policy.json --query 'Role.Arn' --output text)
aws iam attach-role-policy --role-name neon-benchmark-lambda-execute-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaRole
aws iam attach-role-policy --role-name neon-benchmark-lambda-execute-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 4. Upload the lambda code:
echo "(4/5) Creating Lambda — this may take a few seconds."
LAMBDA_ARN=$(aws lambda create-function --function-name BenchmarkRunner --runtime nodejs20.x --role $ROLE_ARN --handler index.handler --timeout 120 --zip-file fileb://lambda.zip --query 'FunctionArn' --output text --environment Variables={API_KEY=$API_KEY})

# 5. Schedule every 30 minutes:
echo "(5/5) Creating schedule."
aws scheduler create-schedule \
    --name NeonColdBenchmarkScheduler \
    --schedule-expression "rate(30 minutes)" \
    --target "{\"RoleArn\": \"$ROLE_ARN\", \"Arn\":\"$LAMBDA_ARN\" }" \
    --flexible-time-window '{ "Mode": "FLEXIBLE", "MaximumWindowInMinutes": 15}'

echo "Deployment complete."