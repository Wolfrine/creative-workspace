# Unshipped callable and backup reference

The owner requires Firebase Spark. `firebase.json` has no Functions or Storage
deployment source. `src/cloud/spark.ts` is the current writing backend adapter.

The older callable/Storage/scheduled-backup implementation, its environment
template and tests remain here as reference and historical integrity evidence.
Do not deploy it, request its IAM/billing prerequisites, or count its tests as
current Spark backend acceptance.

`scripts/prepare-spark-release.mjs`, `scripts/deploy-spark-rules.mjs` and
`scripts/inspect-firebase.mjs` use the
installed Admin SDK only inside GitHub Actions. The browser integration suite
also uses that SDK against explicitly guarded loopback emulators. Neither use
deploys Functions or enables paid services.
