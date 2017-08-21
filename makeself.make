#!/bin/sh

NODEEXE=$(which node)
BREWTEMPDIR=`mktemp -d  /tmp/brewtemp.XXXXXX` || exit 1
echo "Making self in $BREWTEMPDIR"

echo './node brewableserverbundle.js "$@"' > $BREWTEMPDIR/run.sh
chmod a+x $BREWTEMPDIR/run.sh
cp $NODEEXE $BREWTEMPDIR
cp -p build/js/brewable* $BREWTEMPDIR
makeself $BREWTEMPDIR brewable 0.7 ./run.sh
sed -i  -e 's/quiet="n"/quiet="y"/' \
	-e 's/noprogress=n/noprogress=y/' \
	brewable

#rm -rf $BREWTEMPDIR

