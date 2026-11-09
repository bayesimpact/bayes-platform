#!/usr/bin/env bash
# Turns Trivy JSON reports into a short Markdown table per image. Only the
# HIGH and CRITICAL findings are listed: they are the ones that fail the job.
#
# Usage: trivy-report.sh <summary.md> "<label>=<report.json>" ...
#
# Appends the Markdown to <summary.md> (the job's $GITHUB_STEP_SUMMARY), prints
# one line per finding in the job log and emits one error annotation per
# finding, so the PR checks page names the CVE and its fixed version.
set -euo pipefail

summary="$1"
shift

md() { printf '%s\n' "$@" >>"$summary"; }

md "## Trivy vulnerability scan" "" "HIGH and CRITICAL findings with a fix available, after \`.trivyignore.yaml\`." ""

for entry in "$@"; do
  label="${entry%%=*}"
  file="${entry#*=}"

  if [ ! -s "$file" ]; then
    md "### ${label}: scan did not run" ""
    echo "${label}: scan did not run"
    continue
  fi

  # One TSV row per finding: severity, package, installed, fixed, id, url, target.
  rows="$(jq -r '
    .Results[]? as $result
    | (
        ($result.Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL") | [
          .Severity,
          .PkgName,
          .InstalledVersion,
          (.FixedVersion // ""),
          .VulnerabilityID,
          (.PrimaryURL // ""),
          (.PkgPath // $result.Target)
        ]),
        ($result.Secrets[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL") | [
          .Severity,
          ("secret " + .RuleID),
          ("line " + (.StartLine | tostring)),
          "remove it",
          .Title,
          "",
          $result.Target
        ])
      )
    | @tsv
  ' "$file")"

  if [ -z "$rows" ]; then
    md "### ${label}: no HIGH or CRITICAL finding" ""
    echo "${label}: no finding"
    continue
  fi

  count="$(printf '%s\n' "$rows" | wc -l | tr -d ' ')"
  md "### ${label}: ${count} HIGH or CRITICAL finding(s)" "" \
    "| Severity | Package | Installed | Fixed in | Vulnerability | Found in |" \
    "|---|---|---|---|---|---|"
  while IFS=$'\t' read -r severity package installed fixed id url target; do
    link="$id"
    [ -n "$url" ] && link="[${id}](${url})"
    md "| ${severity} | \`${package}\` | \`${installed}\` | \`${fixed}\` | ${link} | ${target} |"
    echo "::error title=Trivy ${label}::${severity} ${id} in ${package} ${installed}, fixed in ${fixed} (${target})"
  done <<<"$rows"
  md ""
done
