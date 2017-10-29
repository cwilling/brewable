#!/bin/sh

NODEEXE=$(which node)
BREWTEMPDIR=`mktemp -d  /tmp/brewtemp.XXXXXX` || exit 1
TARGET=$(pwd)/brewable
VERSION=0.4.1

echo './node brewableserverbundle.js "$@"' > $BREWTEMPDIR/run.sh
chmod a+x $BREWTEMPDIR/run.sh
cp $NODEEXE $BREWTEMPDIR
cp -p build/js/brewable*.js $BREWTEMPDIR
makeself --noprogress --nox11 $BREWTEMPDIR $TARGET $VERSION ./run.sh
sed -i  -e 's/quiet="n"/quiet="y"/' \
	$TARGET

rm -rf $BREWTEMPDIR

