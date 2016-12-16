# Edgy

**[Try the app!](https://snapapps.github.io/edgy/app/edgy.html)**

Edgy is a block-based programming language and an algorithm design environment that runs in a web browser. It provides a hands on interface to manipulate graphs via algorithms.

## Dependencies
Edgy is powered by both [Snap!](http://snap.berkeley.edu/) (from UC Berkeley)  which allows you to snap blocks together to build programs, and [JSNetworkX](http://felix-kling.de/JSNetworkX/) to both visualise and provide functionality to work with graphs.

Currently Edgy has two force-directed layout algorithms. By default Edgy uses the [WebCoLa](http://marvl.infotech.monash.edu/webcola/examples/unconstrainedsmallworld.html) algorithm to arrange graphs, but you can switch to the original [D3.js](http://bl.ocks.org/mbostock/4062045) algorithm if it suits you better.

## Example
Here is an example of minimal spanning tree, adapted from Tim Bell's CS Unplugged [Muddy City](http://csunplugged.org/sites/default/files/activity_pdfs_old/unplugged-09-minimal_spanning_trees-original.pdf) activity.

![Muddy city code](https://snapapps.github.io/images/muddycitycode3.png)
![Muddy city graph](https://snapapps.github.io/images/muddycity3.png)

## Tutorials
Not sure on where to start in using Edgy? Click one of the links below to start learning how to use this web application.
* [Programming with Edgy (8 modules including screencasts)](https://www.alexandriarepository.org/syllabus/programming-with-edgy/)
* [Screencast: drawing graphs](http://goo.gl/YV7Jko)
* [Screencast: first program](http://goo.gl/7ElphI)
* [Screencast: variables](http://goo.gl/MbI4A1)
* [Screencast: loops](http://goo.gl/pCGdc3)

## TODO
* Display graph in preview window when opening projects (Edgy currently displays it as a generic sprite).

## Development

Edgy has been developed by [Steven Bird](http://stevenbird.net/) and students (Mak Nazečić-Andrlon, Jarred Gallina) at the University of Melbourne.

### Keeping Snap! clean

In general, changes should be made in the files that reside in the `edgy` directory to avoid causing merge conflicts with Snap!.
See the changeset files `edgy/changesToObjects.js`, `edgy/changesToGui.js` etc. 

### Updating Snap! version

To merge the upstream Snap! repository:
- In a fork of the repository, add the upstream repo if it isn't already in `git remote -v`:
  
  ```bash
  git remote add snap https://github.com/jmoenig/Snap--Build-Your-Own-Blocks.git
  ```
  
- Make sure the upstream repo is up to date:
  
  ```bash
  git fetch snap
  ```
  
- Create a new branch (called `UpdateSnap`) from `master`
  
  ```bash
  git checkout master
  git checkout -b UpdateSnap
  ```
  
- Merge the Snap! repository:
  
  ```bash
  git merge snap/master
  ```
  
  - Conflicts may have occurred in certain functions of `gui.js`, `objects.js` and/or `store.js`, which have been marked with the comment
    
    ```javascript
    // NOTE: This function may cause merge conflicts with the Snap! repository.
    ```
    
    These conflicts will have to be resolved manually.
- Commit the results and create a pull request.