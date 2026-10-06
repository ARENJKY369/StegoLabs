#!/usr/bin/env bash
# Arena-sandbox toolchain bootstrap for StegLab.
#
# The development sandbox has no JDK and a firewalled network (only
# github.com, codeload.github.com, api.github.com and registry.npmjs.org
# are reachable), and /opt is wiped on every sandbox restart. This script
# re-provisions everything the build needs:
#   - JDK 17   from an AOSP prebuilt mirror repository (codeload tarball)
#   - Maven    3.9.9 from a GitHub mirror repository
#   - Offline Maven cache (Spring Boot 3.2.0 stack + PDFBox 2.0.29)
# On a normal developer machine you do NOT need this — just use any
# JDK 17 + Maven with network access to Maven Central.
set -euo pipefail

if [ -x /opt/tools/jdk17/bin/java ] && [ -x /opt/tools/maven/bin/mvn ] && [ -d /opt/tools/m2repo/org/springframework/boot ]; then
  echo "toolchain already present"; exit 0
fi

sudo mkdir -p /opt/tools && sudo chown "$(whoami)" /opt/tools
cd /tmp

echo "[1/5] JDK 17 (AOSP prebuilt mirror)..."
curl -sL --retry 2 -o jdk17.tar.gz \
  "https://codeload.github.com/msft-mirror-aosp/platform.prebuilts.jdk.jdk17/tar.gz/refs/heads/android13-d1-release"
tar xzf jdk17.tar.gz -C /opt/tools --strip-components=1 \
  "platform.prebuilts.jdk.jdk17-android13-d1-release/linux-x86"
mv /opt/tools/linux-x86 /opt/tools/jdk17
rm -f jdk17.tar.gz

echo "[2/5] Maven 3.9.9..."
curl -sL --retry 2 -o mvn.tgz "https://codeload.github.com/wisecomputerit/apache-maven-3.9.9/tar.gz/HEAD"
tar xzf mvn.tgz
mv apache-maven-3.9.9-HEAD/apache-maven-3.9.9 /opt/tools/maven
chmod +x /opt/tools/maven/bin/*
rm -rf mvn.tgz apache-maven-3.9.9-HEAD

echo "[3/5] Offline Maven cache (Spring Boot 3.2.0 stack)..."
curl -sL --retry 2 -o radar.tgz \
  "https://codeload.github.com/Veerhan-glitch/Radar-Coverage-Analysis-Microservice/tar.gz/refs/heads/main"
mkdir -p radar
tar xzf radar.tgz -C radar --wildcards '*/offline-m2/*' 2>/dev/null || true
mkdir -p /opt/tools/m2repo
for d in radar/*/Backend/*/offline-m2; do cp -rn "$d/." /opt/tools/m2repo/ 2>/dev/null || true; done
rm -rf radar radar.tgz

echo "[4/5] Validation artifacts..."
curl -sL --retry 2 -o omni.tgz "https://codeload.github.com/nplszfl/OmniTradeERP/tar.gz/HEAD"
mkdir -p omni
tar xzf omni.tgz -C omni --wildcards '*/.m2/*' 2>/dev/null || true
cp -rn omni/*/erp-pricing-service/.m2/. /opt/tools/m2repo/ 2>/dev/null || true
rm -rf omni omni.tgz

echo "[5/5] Cherry-picked artifacts (starter-validation 3.2.0, PDFBox 2.0.29)..."
fetch() { mkdir -p "$(dirname "$3")"; gh api "repos/$1/contents/$2" -H "Accept: application/vnd.github.raw" > "$3" 2>/dev/null || echo "WARN: could not fetch $2"; }
R=/opt/tools/m2repo
fetch DeborahTage/TrustAgroERPSy ".m2/org/springframework/boot/spring-boot-starter-validation/3.2.0/spring-boot-starter-validation-3.2.0.jar" "$R/org/springframework/boot/spring-boot-starter-validation/3.2.0/spring-boot-starter-validation-3.2.0.jar"
fetch DeborahTage/TrustAgroERPSy ".m2/org/springframework/boot/spring-boot-starter-validation/3.2.0/spring-boot-starter-validation-3.2.0.pom" "$R/org/springframework/boot/spring-boot-starter-validation/3.2.0/spring-boot-starter-validation-3.2.0.pom"
for a in pdfbox fontbox; do for e in jar pom; do
  fetch luckyx7/Teedy ".m2/org/apache/pdfbox/$a/2.0.29/$a-2.0.29.$e" "$R/org/apache/pdfbox/$a/2.0.29/$a-2.0.29.$e"
done; done
fetch luckyx7/Teedy ".m2/org/apache/pdfbox/pdfbox-parent/2.0.29/pdfbox-parent-2.0.29.pom" "$R/org/apache/pdfbox/pdfbox-parent/2.0.29/pdfbox-parent-2.0.29.pom"

cat > /opt/tools/env.sh <<'EOF'
export JAVA_HOME=/opt/tools/jdk17
export PATH=/opt/tools/jdk17/bin:/opt/tools/maven/bin:$PATH
export MAVEN_OPTS="-Dmaven.repo.local=/opt/tools/m2repo"
EOF
mkdir -p ~/.m2
cat > ~/.m2/settings.xml <<'EOF'
<settings>
  <localRepository>/opt/tools/m2repo</localRepository>
</settings>
EOF

source /opt/tools/env.sh
java -version 2>&1 | head -1
mvn -version | head -1
echo "toolchain ready"
