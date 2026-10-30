#!/bin/bash
# =============================================================================
# SCRIPT: Determine Build Artifact from GitHub Releases
# PURPOSE: Find and validate the correct artifact from a GitHub release
# USAGE: ./determine-artifact.sh --tag <tag> --repo <repo> --version <version> --prefix <prefix> --output <output_file>
#
# The release event that triggers the Publish workflow is fired from inside the
# Main workflow's create-release job, so the Main run that built the artifact
# is normally still "in_progress" when this script runs. Rather than filtering
# on completed runs (which would never match at that point), the script finds
# the run and waits for it to complete, then requires a "success" conclusion
# before trusting its artifacts.
# =============================================================================

set -euo pipefail

# Default values
TAG_NAME=""
REPO=""
VERSION=""
PREFIX=""
OUTPUT_FILE=""

# How long to wait for an in-progress Main run to complete. After publishing
# the release, Main only has a trivial output step left, so this is generous.
RUN_WAIT_INTERVAL="${RUN_WAIT_INTERVAL:-10}" # seconds between polls
RUN_WAIT_ATTEMPTS="${RUN_WAIT_ATTEMPTS:-30}" # 30 x 10s = 5 minutes

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)
      TAG_NAME="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --prefix)
      PREFIX="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [ -z "$TAG_NAME" ] || [ -z "$REPO" ] || [ -z "$VERSION" ] || [ -z "$PREFIX" ] || [ -z "$OUTPUT_FILE" ]; then
  echo "❌ Missing required parameters"
  echo "Usage: $0 --tag <tag> --repo <repo> --version <version> --prefix <prefix> --output <output_file>"
  exit 1
fi

API="https://api.github.com/repos/$REPO"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

# GET a GitHub API URL and print the response body. Fails on non-200 status.
gh_api() {
  local url="$1"
  local response status body
  response=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" -w "\n%{http_code}" "$url")
  status=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)

  if [ "$status" != "200" ]; then
    echo "❌ GitHub API request failed for $url with status $status" >&2
    echo "Response: $body" >&2
    return 1
  fi

  echo "$body"
}

# Poll a workflow run until it completes and print its conclusion.
# Fails if the run is still not complete after RUN_WAIT_ATTEMPTS polls.
wait_for_run_conclusion() {
  local run_id="$1"
  local attempt=0 run status conclusion

  while :; do
    run=$(gh_api "$API/actions/runs/$run_id")
    status=$(echo "$run" | jq -r '.status')
    conclusion=$(echo "$run" | jq -r '.conclusion')

    if [ "$status" = "completed" ]; then
      echo "$conclusion"
      return 0
    fi

    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$RUN_WAIT_ATTEMPTS" ]; then
      echo "❌ Workflow run $run_id is still '$status' after $attempt attempts" >&2
      return 1
    fi

    echo "⏳ Workflow run $run_id is '$status'; waiting ${RUN_WAIT_INTERVAL}s (attempt $attempt/$RUN_WAIT_ATTEMPTS)" >&2
    sleep "$RUN_WAIT_INTERVAL"
  done
}

# Print the artifact with the given name from a workflow run, or nothing.
find_run_artifact() {
  local run_id="$1" name="$2"
  gh_api "$API/actions/runs/$run_id/artifacts?per_page=100" \
    | jq -c --arg name "$name" '.artifacts[] | select(.name == $name)'
}

# -----------------------------------------------------------------------------
# Resolve the release tag to the commit that triggered the build
# -----------------------------------------------------------------------------

echo "🔍 Determining artifact source for $PREFIX-$VERSION from release $TAG_NAME"

TAG_BODY=$(gh_api "$API/git/refs/tags/$TAG_NAME")
TAG_OBJECT_SHA=$(echo "$TAG_BODY" | jq -r '.object.sha')
TAG_OBJECT_TYPE=$(echo "$TAG_BODY" | jq -r '.object.type')

echo "📌 Tag $TAG_NAME points to $TAG_OBJECT_TYPE: $TAG_OBJECT_SHA"

# Determine the commit SHA based on tag type
if [ "$TAG_OBJECT_TYPE" = "tag" ]; then
  # Annotated tag - fetch the tag object to get the commit SHA
  COMMIT_SHA=$(gh_api "$API/git/tags/$TAG_OBJECT_SHA" | jq -r '.object.sha')
  echo "📌 Annotated tag references commit: $COMMIT_SHA"
elif [ "$TAG_OBJECT_TYPE" = "commit" ]; then
  # Lightweight tag - directly references a commit
  COMMIT_SHA="$TAG_OBJECT_SHA"
  echo "📌 Lightweight tag directly references commit: $COMMIT_SHA"
else
  echo "❌ Unexpected tag object type: $TAG_OBJECT_TYPE"
  exit 1
fi

# The tag points to the version commit, but artifacts were built with the previous commit
# Get the parent commit (the one that triggered the build)
echo "🔍 Getting parent commit of $COMMIT_SHA"
PARENT_SHA=$(gh_api "$API/commits/$COMMIT_SHA" | jq -r '.parents[0].sha')
echo "📌 Parent commit (build trigger): $PARENT_SHA"

# -----------------------------------------------------------------------------
# Primary: the Main run for the parent commit
# -----------------------------------------------------------------------------

ARTIFACT=""
RUN_ID=""
BUILD_SHA=""

echo "🔍 Searching for the Main workflow run for parent commit $PARENT_SHA"
MAIN_RUN_ID=$(gh_api "$API/actions/runs?head_sha=$PARENT_SHA&event=push&per_page=100" \
  | jq -r '[.workflow_runs[] | select(.name == "Main")] | sort_by(.created_at) | last | .id // empty')

if [ -n "$MAIN_RUN_ID" ]; then
  echo "✅ Found Main workflow run: $MAIN_RUN_ID"
  CONCLUSION=$(wait_for_run_conclusion "$MAIN_RUN_ID")

  if [ "$CONCLUSION" = "success" ]; then
    ARTIFACT_NAME="$PREFIX-$VERSION-$PARENT_SHA"
    ARTIFACT=$(find_run_artifact "$MAIN_RUN_ID" "$ARTIFACT_NAME")

    if [ -z "$ARTIFACT" ]; then
      echo "❌ Artifact $ARTIFACT_NAME not found in workflow run $MAIN_RUN_ID"
      echo "Available artifacts:"
      gh_api "$API/actions/runs/$MAIN_RUN_ID/artifacts?per_page=100" | jq -r '.artifacts[].name'
      exit 1
    fi

    RUN_ID="$MAIN_RUN_ID"
    BUILD_SHA="$PARENT_SHA"
  else
    echo "⚠️  Main workflow run $MAIN_RUN_ID concluded with '$CONCLUSION'; its artifacts will not be published"
  fi
else
  echo "⚠️  No Main workflow run found for parent commit $PARENT_SHA"
fi

# -----------------------------------------------------------------------------
# Fallback: the original release run failed after pushing the tag, and a later
# Main run retried the release. Its artifact is named after that run's commit,
# so search the repository's recent artifacts by version prefix instead. Only
# artifacts from a successful Main push run are accepted.
# -----------------------------------------------------------------------------

if [ -z "$ARTIFACT" ]; then
  echo "🔍 Searching recent artifacts for $PREFIX-$VERSION-* from successful Main runs"

  # Most recent non-expired artifacts for this version, newest first
  CANDIDATES=$(gh_api "$API/actions/artifacts?per_page=100" \
    | jq -c --arg prefix "$PREFIX-$VERSION-" \
      '[.artifacts[] | select((.name | startswith($prefix)) and (.expired | not))] | sort_by(.created_at) | reverse | .[]')

  while IFS= read -r CANDIDATE; do
    [ -z "$CANDIDATE" ] && continue

    CANDIDATE_NAME=$(echo "$CANDIDATE" | jq -r '.name')
    CANDIDATE_RUN_ID=$(echo "$CANDIDATE" | jq -r '.workflow_run.id')
    CANDIDATE_SHA=$(echo "$CANDIDATE" | jq -r '.workflow_run.head_sha')

    # The artifact must have been built from the commit of the run it belongs to
    if [ "$CANDIDATE_NAME" != "$PREFIX-$VERSION-$CANDIDATE_SHA" ]; then
      echo "⏭️  Skipping $CANDIDATE_NAME: name does not match its run's commit $CANDIDATE_SHA"
      continue
    fi

    CANDIDATE_RUN=$(gh_api "$API/actions/runs/$CANDIDATE_RUN_ID")
    CANDIDATE_WORKFLOW=$(echo "$CANDIDATE_RUN" | jq -r '.name')
    CANDIDATE_EVENT=$(echo "$CANDIDATE_RUN" | jq -r '.event')

    if [ "$CANDIDATE_WORKFLOW" != "Main" ] || [ "$CANDIDATE_EVENT" != "push" ]; then
      echo "⏭️  Skipping $CANDIDATE_NAME: built by '$CANDIDATE_WORKFLOW' ($CANDIDATE_EVENT), not a Main push run"
      continue
    fi

    CONCLUSION=$(wait_for_run_conclusion "$CANDIDATE_RUN_ID")
    if [ "$CONCLUSION" != "success" ]; then
      echo "⏭️  Skipping $CANDIDATE_NAME: Main run $CANDIDATE_RUN_ID concluded with '$CONCLUSION'"
      continue
    fi

    ARTIFACT="$CANDIDATE"
    ARTIFACT_NAME="$CANDIDATE_NAME"
    RUN_ID="$CANDIDATE_RUN_ID"
    BUILD_SHA="$CANDIDATE_SHA"
    echo "✅ Found artifact from successful Main workflow run: $RUN_ID"
    break
  done <<< "$CANDIDATES"

  if [ -z "$ARTIFACT" ]; then
    echo "❌ No artifact matching $PREFIX-$VERSION-* from a successful Main run found"
    exit 1
  fi
fi

ARTIFACT_ID=$(echo "$ARTIFACT" | jq -r '.id')
ARTIFACT_SIZE=$(echo "$ARTIFACT" | jq -r '.size_in_bytes')

echo "✅ Found artifact: $ARTIFACT_NAME (ID: $ARTIFACT_ID, Size: $ARTIFACT_SIZE bytes)"

# Output the results for GitHub Actions
{
  echo "artifact_name=$ARTIFACT_NAME"
  echo "artifact_id=$ARTIFACT_ID"
  echo "run_id=$RUN_ID"
  echo "commit_sha=$BUILD_SHA"  # Commit that built the artifacts
} >> "$OUTPUT_FILE"

echo "✅ Artifact information written to $OUTPUT_FILE"
