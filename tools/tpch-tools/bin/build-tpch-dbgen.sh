#!/usr/bin/env bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

##############################################################
# This script is used to build tpch-dbgen
# TPC-H_Tools_v3.0.0.zip is from https://www.tpc.org/tpc_documents_current_versions/current_specifications5.asp
# Usage:
#    sh build-tpch-dbgen.sh
##############################################################

set -eo pipefail

ROOT=$(dirname "$0")
ROOT=$(
    cd "${ROOT}"
    pwd
)

CURDIR="${ROOT}"
TPCH_DBGEN_DIR="${CURDIR}/TPC-H_Tools_v3.0.0/dbgen"

check_prerequest() {
    local CMD=$1
    local NAME=$2
    if ! command -v ${CMD} >/dev/null 2>&1; then
        echo "${NAME} is missing. This script depends on unzip to extract files from TPC-H_Tools_v3.0.0new.zip"
        exit 1
    fi
}

check_prerequest "unzip" "unzip"

# download tpch tools pacage first
if [[ -d ${TPCH_DBGEN_DIR} ]]; then
    echo "Dir ${TPCH_DBGEN_DIR} already exists. Removing it first..."
    rm -rf "${TPCH_DBGEN_DIR}"
fi

if [[ -f "${CURDIR}/TPC-H_Tools_v3.0.0new.zip" ]]; then
    echo "Using local TPC-H_Tools_v3.0.0new.zip"
else
    wget -t 3 -T 30 "https://qa-build.oss-cn-beijing.aliyuncs.com/tools/TPC-H_Tools_v3.0.0new.zip" -O "${CURDIR}/TPC-H_Tools_v3.0.0new.zip"
fi
echo "Extracting dbgen source only (skipping ref_data)..."
unzip -o "${CURDIR}/TPC-H_Tools_v3.0.0new.zip" "TPC-H_Tools_v3.0.0/dbgen/*" -d "${CURDIR}/"

# modify tpcd.h - append MYSQL definitions instead of overwriting
cd "${TPCH_DBGEN_DIR}/"
if ! grep -q "MYSQL" tpcd.h 2>/dev/null; then
    cat >>tpcd.h <<'EOF'
#ifdef MYSQL
#define GEN_QUERY_PLAN ""
#define START_TRAN "START TRANSACTION"
#define END_TRAN "COMMIT"
#define SET_OUTPUT ""
#define SET_ROWCOUNT "limit %d;\n"
#define SET_DBASE "use %s;\n"
#endif
EOF
fi

# modify makefile
cp makefile.suite makefile
sed -i 's/^CC[[:space:]]*=.*/CC = gcc/' makefile
sed -i 's/^DATABASE[[:space:]]*=.*/DATABASE = MYSQL/' makefile
sed -i 's/^MACHINE[[:space:]]*=.*/MACHINE = LINUX/' makefile
sed -i 's/^WORKLOAD[[:space:]]*=.*/WORKLOAD = TPCH/' makefile

# compile tpch-dbgen with 10-minute timeout
timeout 600 make 2>&1 || { echo "Build timed out or failed!"; exit 1; }
cd -

# check
if [[ -f ${TPCH_DBGEN_DIR}/dbgen ]]; then
    echo "
################
Build succeed!
################
Run ${TPCH_DBGEN_DIR}/dbgen -h"
    exit 0
else
    echo "Build failed!"
    exit 1
fi
