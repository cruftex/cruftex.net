title: 'Jenkins: How to Analyze Your Plugin Usage'
tags: Jenkins
date: 2015-11-30 23:51:59
---


Ever wondered whether plugins in your Jenkins installation are really used at all? Or do you need to know what
plugins you need to install, to take over some existing jobs from another Jenkins instance? Here is how you can find
out about your plugin usage, and a tiny shell script to analyze your Jenkins configuration and get an index 
all the needed plugins.

<!-- more -->

## The XML Configuration Files

Jenkins stores all its configuration in a bunch of XML Files in the jenkins-home directory. The layout of the
directory is described [jenkins-ci: Administering Jenkins](https://wiki.jenkins-ci.org/display/JENKINS/Administering+Jenkins).

Here is an example of a job configuration file, that contains a system groovy script:

```` xml
<?xml version='1.0' encoding='UTF-8'?>
<project>
  ... stripped standard job configuration parameters ... 
  <builders>
    <hudson.plugins.groovy.SystemGroovy plugin="groovy@1.27">
      <scriptSource class="hudson.plugins.groovy.StringScriptSource">
        <command> ... groovy code left out ... 
        </command>
      </scriptSource>
    </hudson.plugins.groovy.SystemGroovy>
  </builders>
</project>
````

The interesting part is the `plugin="groovy@1.27"` attribute, which contains the plugin name and the version of it.
This information is used by jenkins to warn about missing plugins and to migrate older configuration versions
to new formats.

So why not parse the XML files and extract the information?

## List Configuration Files with Plugin Usage Information

For extracting the information from the XML files we use the shell script tools `xml2` and `awk`. The `xml2` utility
converts an XML file to a simple line by line representation so you can parse it with standard unix tools like `grep` 
and `awk`.

The `xml2` output of the above file is:

````
/project=
/project=  ... stripped standard job configuration parameters ... 
/project=  
/project/builders/hudson.plugins.groovy.SystemGroovy/@plugin=groovy@1.27
/project/builders/hudson.plugins.groovy.SystemGroovy/scriptSource/@class=hudson.plugins.groovy.StringScriptSource
/project/builders/hudson.plugins.groovy.SystemGroovy/scriptSource/command= ... groovy code left out ... 
/project/builders/hudson.plugins.groovy.SystemGroovy/scriptSource/command= 
````

Next we use `awk` to extract only the plugin information:

```` ---
$ cat config.xml | xml2 | awk -F= '$1 ~ /^.*@plugin/ { print $2; }'
groovy@1.27
````

Now let's scan through all XML files of a Jenkins installation and extract the plugin information.

```` bash
cd $JENKINS_HOME
find . -maxdepth 3 -type f -name \*.xml -printf '%P\n' | while read I; do 
    xml2 < "$I" | awk -vf="$I" -F= '$1 ~ /^.*@plugin/ { print f"^"$2; }' | sort | uniq; 
  done | sort | awk -F^ '$1 != header { print "## "$1; header=$1; } { print "- "$2; }'
````

This tiny script produces a Markdown formatted output with configuration file as headline and a list of the used
plugins. Example output:
 
```` markdown
## cloudbees-disk-usage-simple.xml
- cloudbees-disk-usage-simple@0.5
## credentials.xml
- credentials@1.24
- ssh-credentials@1.11
## hudson.maven.MavenModuleSet.xml
- maven-plugin@2.12.1
## hudson.plugins.analysis.core.GlobalSettings.xml
- analysis-core@1.74
## hudson.plugins.copyartifact.TriggeredBuildSelector.xml
- copyartifact@1.37
. . .
````

## Plugin Usage Index

The above result is not too bad. However, we want to know which plugin is used by which jobs. So let's reverse the
index. The script is actually almost the same, we just need to twist the list output of the inner `awk` script:

```` bash
 cd $JENKINS_HOME
find . -maxdepth 3 -type f -name \*.xml -printf '%P\n' | while read I; do 
    xml2 < "$I" | awk -vf="$I" -F= '$1 ~ /^.*@plugin/ { print $2"^"f; }' | sort | uniq; 
  done | sort | awk -F^ '$1 != header { print "## "$1; header=$1; } { print "- "$2; }'
````

The result:

```` markdown
## analysis-collector@1.45
- jobs/build=cache2k/config.xml
## analysis-core@1.74
- hudson.plugins.analysis.core.GlobalSettings.xml
- jobs/build=cache2k/config.xml
## ant@1.2
- hudson.tasks.Ant.xml
## cloudbees-disk-usage-simple@0.5
- cloudbees-disk-usage-simple.xml
## copyartifact@1.37
- hudson.plugins.copyartifact.TriggeredBuildSelector.xml
## credentials@1.24
- credentials.xml
## cvs@2.12
- hudson.scm.CVSSCM.xml
## git@2.4.0
- hudson.plugins.git.GitSCM.xml
- jobs/build=cache2k/config.xml
. . .
````

## Missing Information with Workflow

In the above example the job `build=cache2k` is a Maven job. But, with the new Jenkins Workflow plugin, things change 
how you define your Jenkins jobs. Instead of a structured XML file, which contains the plugin configuration, 
with workflow, a job is just a groovy script, or, to be more precise, a groovy-ish Workflow DSL. So, no plugin 
information any more, just script code.
  
It should be technically feasible to log the information of the used plugins at runtime. For this
I opened [JENKINS-31582](https://issues.jenkins-ci.org/browse/JENKINS-31582), please vote for it.
 
## Alternatives

There is a [Plugin Usage Plugin](http://documentation.cloudbees.com/docs/cje-user-guide/plugin-usage-using.html) in
commercial CloudBees Jenkins Platform offering. There is also 
[Plugin Usage Plugin Community](https://wiki.jenkins-ci.org/display/JENKINS/Plugin+Usage+Plugin+\(Community\))

While these plugins are useful, and just run OOTB, I think using the presented approach above has some values of
 its own:
 
 * easily analyze a Jenkins configuration without running
 * Simple customizable text output, to be included in an infrastructure documentation
