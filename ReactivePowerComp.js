/*

The aim of this tool is to teach students fundamental concepts in the areas of i) real/reacive power, ii) current (rms&phase) from those powers, iii) concepts of power factor and iv) how to improve the power factor by supplying recive power form a capacitor.

KEY OUTCOMES:
    This application examines a simple circuit consisting of three elements 
        i) A supply,
        ii) a load and
        iii) a power factor correction capacitance.

    This application calculates the parameters of the internal state of the above elements and calulates
        i) the supply real power
        ii) the supply reactive power
        iii) the supply current
        iv) the supply power factor
        v) the supply apparent powe

    The follow is plotted: 
        i) voltage and current waveform
        ii) voltage and current phasor
        iii) instantaneous power time series
        iv) the "power triangle"

STRUCTURE OF THIS SCRIPT
    The following code is seperate into three key sections
        Section 1: Initilising variables used in the circuit.
        Section 2: Setting up the interface.
        Section 3: FUNCTIONS.
        
    Details of each section can be found in the respective sections below.
    
DISPLAY SETUP:
    The code loads a single svg representing the circuit with three stacked objects (hidden load, series load, parallel load). Two of these objects are hidden
    The SVG has a number of elements (like rectanges or text) which are given an id:[name] which can be accessed similar to a DOM elements,
    The plots provided are drawn in the provided html/css DIV of  plotDivs.waveformDiv, plotDivs.phasorDiv and plotDivs.powerDiv.
*/

//Wrapping in a function to avoid namespace problems when uploaded to myuni. Should not be an issue since iframe have seperate namespace but just incase myuni changes.
(function(){
    
    math.config({
       matrix: 'Array' 
    });

    /*
    ________________________________________________________
    Section 1: Initilising variables used in the circuit.
    ________________________________________________________
    Main variables are:
        timeStepData: for setting start.stop and step times
        QcompCircuit: representing the circuit
        animationFlags: for controlling the animation state
        waveformData: used for plotting
    */
    //the following are the parameters for handling the timestep
    let tStart=0.0;
    let tEnd=0.04;
    let tStep=tEnd/240;//This can be used to set the framerate for animation

    /*
    The following  qcompcircuit represents the circuit on screen.
        It contains the power, current, [angles of V,I and P] and the equivilent R&X values
        It also contains the times used for the plots.
    */
        
    let QcompCircuit={
        //input circuit data
        VSupply: 240,
        angVSupply:0,
        freq: 50, //hz
    //Initilising calculated parmaeters 
        //powers
            loadRealPower: 0,
            loadReactivePower: 0,
            supplyReactivePower: 0,
            supplyApparentPower: 0,
            supplyPowerFactor: 0,
            supplyAngPF: 0,
            supplyAngI:0,
            capQ:0,
        //current
            supplyIrms: 0,
            supplyAngI: 0,
        //Load R & X and CAp
            loadRSeries: 0,
            loadRParallel: 0,
            loadXSeries: 0,
            loadXParallel: 0,
            capValue: 0,
        //setting up waveform timeseries
            timeX: math.range(tStart, tEnd, tStep)
    };
    //representings the timesteps as angular steps
    QcompCircuit.ThetaX=math.multiply(QcompCircuit.timeX, QcompCircuit.freq*360); 

    //Flag used for the animations
    let animationState={
        isRunning: true,
        isStepping: false,
        boxUpdated: false
    };
    

    //generator used to iterated through the timesteps
    let timeIndex=timeStepGen(0,QcompCircuit.timeX.length-1);
    
    //Can speed up the animation Typically we want to display each timestep.
    // for plotly
    const frameDuration=0; 
    const transitionDuration=0;

    //Constructing the voltage wave (this doesn't change)
    let Wt=math.multiply(2*math.pi*50,QcompCircuit.timeX)
    let Vpeak=math.sqrt(2)*QcompCircuit.VSupply
    let voltWave=math.multiply(Vpeak,math.sin(math.add(Wt,QcompCircuit.angVSupply))); //alows the supply to have an angle

    //constructing the four groups of data for plotting
    let [waveformData, waveformLayout]=createWaveformData(QcompCircuit.timeX,voltWave,0 );
    let [phasorData, phasorLayout]=createPhasorData(QcompCircuit.VSupply,QcompCircuit.SupplyIrms,QcompCircuit.supplyAngPF);
    let [instantaneousPower,instantaneousPowerLayout]=createIntantPower(QcompCircuit.timeX,0);
    let [powerTriangle,powerTriangleLayout]=createPowerTriangle(QcompCircuit.loadRealPower, QcompCircuit.supplyReactivePower,QcompCircuit.supplyApparentPower);

/*
________________________________________________________
Section 2: Setting up the interface.
________________________________________________________
Peforms 3 main tasks
    1) stores the div's from the HTML where the plots are located
        a) Creates the inputs P,Q,C boxes.
    2) Loads in the SVG and stores the various elements of the SVG (e.g. the power text to replace ect)
        a) Positions the input P,Q,C boxes
    3) Adds listerns to the various buttons including:
        a) full screen button
        b) animation control
        c) load diagram control
*/

//Task 1: stores the div's from the HTML where the plots are located
    //Recording plotting divs

    const plotDivs={
        waveformDiv:document.getElementById('waveformDiv'),
        phasorDiv: document.getElementById('phasorDiv'),
        powerDiv: document.getElementById('powerDiv'),
        powerTriangleDiv:  document.getElementById('powerTriangleDiv')
    };
    
    const circuitImageDiv = document.getElementById('circCont');

    // Get the documentElement (<html>) to display the page in fullscreen 
    const pageDoc = document.documentElement;

    //setup the various input fields used by the addField
    const realPowerScroll = document.createElement("input");
    const reactivePowerScroll = document.createElement("input");
    const capScroll = document.createElement("input");
    
    //Recording button elements
        //load buttons div & elements, The div is used to attach only 1 listener for all buttons  and the elements are used for colouring
    loadButtonDiv=document.getElementById('loadChangeButtons');
    
    const buttonLoadConfig={
        hideLoad: document.getElementById('hideLoad'),
        seriesLoad: document.getElementById('seriesLoad'),
        parallelLoad: document.getElementById('parallelLoad')
    }
    
        //animation button div and elements
    const aniButtonDiv=document.getElementById("animationButtons");
    const buttonAnimation={
        start: document.getElementById("startAni"),
        stop: document.getElementById("stopAni"),
        step: document.getElementById("stepAni"),
        resetZero: document.getElementById("resetZero")
    }
        
    //Button Colour when active (will be default style if not selected)
    const colourButtonActive='#90EE90';
    

//Task 2: Loads in the SVG and stores the various elements of the SVG 
    /* Creating the handles for the various fields and svg text elements. These are added when the SVG is read using d3.xml.
     the keys here must match the object Id's given in the SVG.*/
    let circuitSVG={
        //getting ref tohe series/parallel groups  note: inskcape implments its own version of layers (using groups) but the ID of these cannot be accessed (in inkscape layers have seperate label tag from ID tag). Hence each load type is grouped and referenced by accessing the groups object id in the xml.
        hideLoadGroup:null, 
        seriesGroup: null,
        parallelGroup: null,
        //storing P,Q,C box positions
        RealPowerField: null,
        QpowerField: null,
        capField: null,
        //text elements for Supply outputs
        realPowerSupplyText: null, 
        reactivePowerSupplyText: null, 
        currentSupplyText: null,
        sFieldText: null,
        pfFieldText: null,
        //text elements for capacitors
        capQText: null,
        //series and parallel load texts
        parallelRTxt: null,
        parallelXTxt: null,
        seriesRTxt: null,
        seriesXTxt: null
    };

/*setting up the image svgs. Imports the SVG into the DOM using d3.js and obtains links to the various elements in the SVG.
    The SVG is read asynchronous hence the "promises"  must settle before moving on*/
    d3.xml("images/Circuit.svg").then(data => {
        //This obtains the hooks into the SVG, this only works if the circuitSVG object has the same keys as the SVG object ID's
        for (const svgElements in circuitSVG){
            circuitSVG[svgElements]=data.getElementById(svgElements)
        }
        //hide the series and parallel groups. & set the hideload button as selected
        circuitSVG.hideLoadGroup.removeAttribute("style")
        circuitSVG.seriesGroup.setAttribute("style", "display:none");
        circuitSVG.parallelGroup.setAttribute("style", "display:none");
        buttonLoadConfig.hideLoad.style.background=colourButtonActive;
        
        //add svg to current document (in the div circCont)
        d3.select("#circCont").node().append(data.documentElement);         

        return runWhenSVGLoaded()
    });
            
//task 3: Adds listerns to the various buttons
    //Input field box listerners, The buttons live in circuitImageDiv hence the event here contains what box changed
        circuitImageDiv.addEventListener('input', (event)=>{
            //update the image and redraw if not running
            updatecircuitParam(QcompCircuit,parseFloat(realPowerScroll.value),parseFloat(reactivePowerScroll.value),parseFloat(capScroll.value)); 
            animationState.boxUpdated=true;
            if(!animationState.isRunning){window.requestAnimationFrame(animatePlot)}
        });
        
    // fullscreen button listerner defining the function which switches to fullscreen 
    let fullScreenBut=document.getElementById('FullScreenBut')

    fullScreenBut.addEventListener('click', (event)=>{
        if (!document.fullscreenElement){ /*make it fullscreen*/
              if (pageDoc.requestFullscreen) {
                pageDoc.requestFullscreen();
              } else if (pageDoc.webkitRequestFullscreen) { /* Safari */
                pageDoc.webkitRequestFullscreen();
              } else if (pageDoc.msRequestFullscreen) { /* IE11 */
                pageDoc.msRequestFullscreen();
              }
          } else{ /*exit fullscreen*/
                if (document.exitFullscreen) {
                document.exitFullscreen();
              } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
              } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
              }
          }
    });
    
    //redraw figure axes when fullscreen event occurs which don't get redrawn by default when  resized
    pageDoc.addEventListener("fullscreenchange", (event)=> {
        Plotly.relayout(plotDivs.waveformDiv,waveformLayout);
        Plotly.relayout(plotDivs.phasorDiv,phasorLayout);
        Plotly.relayout(plotDivs.powerDiv,instantaneousPowerLayout);
    });

    //adding listeners to the load buttons
    loadButtonDiv.addEventListener('click',(event)=>{
      const isButton=event.target.nodeName === 'BUTTON';  
        if (!isButton){return;}
        changeCircuit(event.target.id)
    });
    
    // Adding listerner to the  animation state buttons
    let stepButton={
        isHeld: false,
        holdTimeout: null,
        intervalHand: null,
        heldWaitDuration:700, // user has to hold down [x] ms
        stepTimeDuration: 50  // step will update every [x] ms
    };
        
    //Ensuring listerns for both mouse and touch
    ['mousedown','touchstart'].forEach(evt=>{
        aniButtonDiv.addEventListener(evt, (event)=>{
          const isButton=event.target.nodeName === 'BUTTON';  
            if (!isButton){return};
            //change state of buttons
             animateState(event.target.id)
             
            //if stepping button is pressed we check to ensure it has been released, to ensure the timeout has finished before a new click (e.g. spam clicking would constantly call if we don't check for release)
            if(event.target.id=='stepAni'){
                stepButton.isHeld=true; 
                
                //Mobile reponse to both down and touch event hence the following onnly allows one event from occuring.
                event.preventDefault(event);
                
                //After holding wait a few seconds to see if the user is still holding down, if they are animate until they release. Need to clear any existing timeoutse
                clearTimeout(stepButton.holdTimeout)
                clearInterval(stepButton.intervalHand)
                
                stepButton.holdTimeout=setTimeout( ()=>{
                    if(stepButton.isHeld==true){
                        stepButton.intervalHand=setInterval(animateState,stepButton.stepTimeDuration,event.target.id)
                    }
                }, stepButton.heldWaitDuration);
            }
        },{passive: false});
    });
        
    //if user stops pressing down or release the step button stop the stepping
    aniButtonDiv.addEventListener('onmouseleave ',(event)=>{
        clearInterval(stepButton.intervalHand)
        stepButton.isHeld=false;
    });
        
    ['mouseup', 'touchend'].forEach(evt=>{
            window.addEventListener(evt,(event)=>{
                clearInterval(stepButton.intervalHand)
                stepButton.isHeld=false;
            },{passive: false});
    });
    
    //disables context menue on the buttons
    aniButtonDiv.addEventListener("contextmenu", e => e.preventDefault());

        
    /*
________________________________________________________
Section 3: FUNCTIONS 
________________________________________________________
The following are a list of functions and a brief description
General:
    runWhenSVGLoaded: After the SVG is loaded, this function runs to draw the plots and place the PQC fields in the appropriate positions
    updatecircuitParam;  Calculates the circuits parameters after the user has inputed new valuea. Calls updateWaveformPhasor to change the plots and updateSVGTxt to change the outputs displayed in the SVG
    
Calculation function
    timeStepGen: Used to get next time step
    rad2deg: Converts radians to degrees
    deg2rad: Converts degrees to radians
    
    
Updating the svg text
    updateSVGTxt: Replaces the text in the SVG for  (supply, P,Q, I and cap C, load & series R&X),  
    
Updates to the plot
    updateWaveformPhasor: Calculates the new waveforms for the plot plot with the newly calculated values from "updateCricuitParam". calls updateCursorPhasor 
    updateCursorPhasor: updates the phasor, and waveform cursor line/dots
    animatePlot:  animation of the waveform and phasor plot. Calls updateCursorPhasor
    
Button Controlls
    animateState: The responds to pressing Animation State buttons.
    changeCircuit: The responds to pressing "change load" Buttons

Setting Up WaveformData
    createWaveformData: Formats the waveform data and sets the layout required  by plotly
    createPhasorData  Formats the phasor data and sets the layout required  by plotly
    createIntantPower:  Formats the power data and sets the layout r equired  by plotly
*/
    

/* After the three svg images are loaded, this function (called only once) performs the following tasks:
    1) add the number fields (PQC) to the page onces the image is loaded. 
    2) Set inital values for these number fields and updates the parameters of the circuit (in the representation  QcompCircuit)
    3) Draws the various plots.
*/
     function runWhenSVGLoaded(){
        //set the real power field
        circuitImageDiv.appendChild(realPowerScroll)
        setNumFields(realPowerScroll,circuitSVG.RealPowerField);
        realPowerScroll.setAttribute('value', '100');
        
        //set reactive power field
        circuitImageDiv.appendChild(reactivePowerScroll)
        setNumFields(reactivePowerScroll,circuitSVG.QpowerField);
        reactivePowerScroll.setAttribute('value', '100');
        
        //set cap field
        circuitImageDiv.appendChild(capScroll)
        setNumFields(capScroll,circuitSVG.capField);
        capScroll.setAttribute('value', '0');
        //the page's first call to updatecircuitParam.
        
        updatecircuitParam(QcompCircuit,parseFloat(realPowerScroll.value),parseFloat(reactivePowerScroll.value),parseFloat(capScroll.value));

        //Creating The four plots
        let waveformPlotConfig = {responsive: true,  scrollZoom: false, displayModeBar: false}
        let phasorTriangPlotConfig={responsive: true,  staticPlot: true};
        
        Plotly.newPlot(plotDivs.waveformDiv, waveformData,waveformLayout,waveformPlotConfig);
        Plotly.newPlot(plotDivs.phasorDiv,phasorData, phasorLayout,phasorTriangPlotConfig);
        
        Plotly.newPlot(plotDivs.powerDiv, instantaneousPower,instantaneousPowerLayout, waveformPlotConfig);
        Plotly.newPlot(plotDivs.powerTriangleDiv, powerTriangle,powerTriangleLayout, phasorTriangPlotConfig);
        
        //animating the plots
        window.requestAnimationFrame(animatePlot)
            //set colour of "start" to active
        buttonAnimation.start.style.background=colourButtonActive;
        
        /*
            Sets the position of the P,Q,C field based on a rect box defined in the SVG
            Only called 3 times when setting up circuit,
        */
        function setNumFields(numField, fieldDocEle){
            //setting properties of the field
            numField.setAttribute('type', 'number');
            numField.setAttribute('class', "inputField");
            numField.style.fontSize="32px";
            
            let boxLeftX=String(fieldDocEle.x.baseVal.value).concat("mm");
            let boxTopY=String(fieldDocEle.y.baseVal.value).concat("mm");
            let boxWidth=String(fieldDocEle.width.baseVal.value-2).concat("mm");
            let boxHeight=String(fieldDocEle.height.baseVal.value-1).concat("mm");
            
            numField.style.left=boxLeftX;
            numField.style.top=boxTopY;
            numField.style.width= boxWidth;
            numField.style.height=boxHeight;
        }
    }   

//Calculating new values of the circuit when user updates input box
    function updatecircuitParam(circuitParam,RealPower,LoadReactivePower,CapValue){
        //setting the intial variables
        circuitParam.loadRealPower=RealPower;
        circuitParam.loadReactivePower=LoadReactivePower;
        circuitParam.capValue=CapValue*math.pow(10,-6);
        
        //calculate the reactive power requirement
        let CapReactivePower=-2*math.pi*circuitParam.freq*circuitParam.capValue*math.square(circuitParam.VSupply);
        circuitParam.capQ=CapReactivePower;
        circuitParam.supplyReactivePower=LoadReactivePower+CapReactivePower;
        
        //calculate the complex power and power factor
        let ComplexPower=math.complex(RealPower,circuitParam.supplyReactivePower)
        let ComplexPowerPolar=ComplexPower.toPolar();
        
        circuitParam.supplyApparentPower=ComplexPowerPolar.r;
        circuitParam.supplyAngPF=ComplexPowerPolar.phi;  //get angle of complex power
        circuitParam.supplyAngI=-circuitParam.supplyAngPF;
        
        circuitParam.supplyPowerFactor=math.cos(circuitParam.supplyAngPF);
        
        //calculate the current
        let IConj=math.divide(ComplexPower, circuitParam.VSupply); //#S=VI*  hence I*=S/V
        let Ihat=math.conj(IConj).toPolar();   //Hat refering to vector version of current i.e. I^  (or complex # version)
        
        circuitParam.supplyIrms=Ihat.r; // 
        circuitParam.supplyAngI=Ihat.phi;
        
        /*
        calculate R and X for parallel and sereis configuration
            Parallel theory: P=V^2/R and Q=V^2/X hence R=V^2/P and X=V^2/Q. Note this works since V across R and V across Q are the same.
            Series theory: S=sqrt(P^2+Q^2)=VI  note this is I load not Isupply =>I=S/V hence:  1)  P=I^2R  & R=P/I^2 2) Q=I^2L  hence L=Q/I^2 
                */
        let complexLoadPower=math.complex(RealPower,LoadReactivePower)
        let Iload=math.divide(math.abs(complexLoadPower), circuitParam.VSupply);
            //Edge cases of P and Q,
            if (RealPower==0 && LoadReactivePower==0){
                circuitParam.loadRSeries=0;
                circuitParam.loadRParallel=Infinity;
                
                circuitParam.loadXSeries=0;
                circuitParam.loadXParallel=Infinity;
            }else if (RealPower==0){
                circuitParam.loadRSeries=0
                circuitParam.loadRParallel=Infinity;
                
                circuitParam.loadXSeries=math.divide(LoadReactivePower, math.square(Iload)) ;
                circuitParam.loadXParallel=math.square(circuitParam.VSupply)/LoadReactivePower;
            }else if (LoadReactivePower==0){
                circuitParam.loadRSeries=math.square(circuitParam.VSupply)/RealPower;
               circuitParam.loadRParallel=math.divide(RealPower, math.square(Iload));
                
                circuitParam.loadXSeries=0;
                circuitParam.loadXParallel=Infinity;
            } else{
               circuitParam.loadRSeries=math.divide(RealPower,math.square(Iload));
                circuitParam.loadRParallel=math.square(circuitParam.VSupply)/RealPower;
                
                circuitParam.loadXSeries=math.divide(LoadReactivePower, math.square(Iload));
                circuitParam.loadXParallel=math.square(circuitParam.VSupply)/LoadReactivePower;
            }
            
        //update the values in the plot with the new values in the circuit
        updateWaveformPhasor(circuitParam)
        //the image contains, Psupply, Qsupply and Isupply and the text needs to be udpated when the circuit updatse
        updateSVGTxt(circuitParam);
    }

//update the waveform values & legend text in the plot when the user enters new values
    function updateWaveformPhasor(circuitParam){
            //updating the waveform and phasor data
        let Ipeak=math.sqrt(2)*circuitParam.supplyIrms;
        
        //temporarly pause the animation running to update the value.
        const pastAnimationState=animationState.isRunning;
        animationState.isRunning=false;
        let currentTimeIndex=timeIndex.next().value
        animationState.isRunning=pastAnimationState;
        
        waveformData[1].y=math.multiply(Ipeak,math.sin(math.add(Wt,circuitParam.supplyAngI)));  
        instantaneousPower[0].y=math.dotMultiply(waveformData[0].y, waveformData[1].y); // dotmultiply means element by element multiplication not vector dot product
        
        //update phasor radial (angule is taken care for in updatePlotVal
        phasorData[1].r=[0, circuitParam.supplyIrms];
        phasorData[2].r=[circuitParam.supplyIrms*math.cos(circuitParam.supplyAngI)];
            
        
        // updating any phasor angle, curos lines and dots
        updateCursorPhasor(circuitParam,currentTimeIndex)
        
        //Update instantaneousPower plots
        let averagePower=math.multiply(circuitParam.VSupply*circuitParam.supplyIrms,math.cos(circuitParam.supplyAngPF))
        instantaneousPower[1].y=math.multiply(averagePower, math.ones(instantaneousPower[1].y.length))
        
        //update power triangle
        powerTriangle[0].x=[0, circuitParam.loadRealPower];
        
        powerTriangle[1].x=[circuitParam.loadRealPower,circuitParam.loadRealPower];
        powerTriangle[1].y=[0,circuitParam.supplyReactivePower]
        
        powerTriangle[2].x=[0,circuitParam.loadRealPower];
        powerTriangle[2].y=[0,circuitParam.supplyReactivePower]
        
        //update  legend names (circuitParam.supplyIrms, circuitParam.supplyAngI  & +- sign of angle)
        let angleISigntxt;
            if (circuitParam.supplyAngI<0){
                angleISigntxt="";
            } else{
                angleISigntxt="+";
            };
        let IrmsTxt=String(circuitParam.supplyIrms.toFixed(3));
        let IangleTxt=String(rad2deg(circuitParam.supplyAngI).toFixed(1));
            
        waveformData[1].name= 'i(t)=&#8730;<span style="text-decoration:overline;">2</span>\u00D7'+IrmsTxt+'\u00D7' +'sin(2' +'&#120587;'+'50t'+ angleISigntxt+ IangleTxt+'\u00B0'+'\u00D7' +'&#120587;'+'/180\u00B0' +')';
        phasorData[1].name = '<b>I</b>='+ IrmsTxt +'\u00D7'+'exp(j2' +'&#120587;'+'50t'+ angleISigntxt+ IangleTxt+'\u00B0'+'\u00D7' +'&#120587;'+'/180\u00B0'+')';
    }
    
    function updateCursorPhasor(circuitParam, currentTimeIndex){
            //update V*I phasor
            phasorData[0].theta=[0, circuitParam.ThetaX[currentTimeIndex]];
            phasorData[1].theta=[0, circuitParam.ThetaX[currentTimeIndex]+rad2deg(circuitParam.supplyAngI)];
            
            phasorData[2].theta=[circuitParam.ThetaX[currentTimeIndex]];
            
            //updating waveform
                //cursor line
           waveformLayout.shapes[0].x0=circuitParam.timeX[currentTimeIndex];
           waveformLayout.shapes[0].x1=circuitParam.timeX[currentTimeIndex];

                //update dot's  V,I on cursor line
            waveformData[2].x=[circuitParam.timeX[currentTimeIndex]];
            waveformData[2].y=[waveformData[0].y[currentTimeIndex]];
            
            waveformData[3].x=[circuitParam.timeX[currentTimeIndex]];
            waveformData[3].y=[waveformData[1].y[currentTimeIndex]];
            
            //updating instant power    
                // cursor line
           instantaneousPowerLayout.shapes[0].x0=circuitParam.timeX[currentTimeIndex];
           instantaneousPowerLayout.shapes[0].x1=circuitParam.timeX[currentTimeIndex];
               //update cursor dot's Average power Instant power on cursor
            instantaneousPower[2].x=[circuitParam.timeX[currentTimeIndex]];
            instantaneousPower[2].y=[instantaneousPower[0].y[currentTimeIndex]];
            
            instantaneousPower[3].x=[circuitParam.timeX[currentTimeIndex]];
            instantaneousPower[3].y=[instantaneousPower[1].y[currentTimeIndex]];
    }

/*animimation functions:
The animation is achieved through a recursive callback  using (window.requestAnimationFrame(animatePlot);)
The animation has three valid states, i) start (continuously running), ii) stop, iii)step.

These states are controlled by Two flags, i)  animationState.isRunning  and i) animationState.isStepping. 
    When animationState.isRunning is true, the animation function will update the plot and then recursively call itself (using a callback). 
    When animationState.isRunning is false, the animation function values won't update and won't call itself.
    When animationState.isStepping is true, the animation function will update the values and update the plot, but the animation function will not call itself.

The animation of the plots are achieved by using a generator function to track the t position of the plots.

Also updates the layout if the P,Q,C boxes have changed there is a need to rescale the axes (currently axes do not rescale), This is achieved through animationState.boxUpdated flag.
*/
    function animatePlot(timestamp){
        
        //only update the values in the plot when its running. Otherwise re-draw 
        if (animationState.isRunning || animationState.isStepping){
                updateCursorPhasor(QcompCircuit,timeIndex.next().value)
            }
        
         animationState.isStepping=false; //stop the stepping
        
        //perform the waveform's animation
        Plotly.animate(plotDivs.waveformDiv,{data:waveformData,  layout:{ shapes:[waveformLayout.shapes[0]]}}, {frame: {duration: frameDuration, redraw: false},transition:{transitionDuration:transitionDuration}});
        //Perform the phasor animation
        Plotly.animate(plotDivs.phasorDiv, {data:phasorData}, {frame: {duration: frameDuration},transition:{transitionDuration:transitionDuration}} );
                                
        Plotly.animate(plotDivs.powerDiv, {data: instantaneousPower, layout:{ shapes:[instantaneousPowerLayout.shapes[0]]}}, {frame: {duration: frameDuration,redraw: false},transition:{transitionDuration:transitionDuration}} );
                            
        if (animationState.boxUpdated){ // if the values have been updated rescale axes
            Plotly.relayout(plotDivs.waveformDiv,waveformLayout);
            Plotly.relayout(plotDivs.phasorDiv,phasorLayout);
            Plotly.relayout(plotDivs.powerDiv,instantaneousPowerLayout);
            Plotly.relayout(plotDivs.powerTriangleDiv,powerTriangleLayout);
            animationState.boxUpdated=false;
        };
        // allows step or constant running
        if (!animationState.isRunning){return};

        window.requestAnimationFrame(animatePlot)       
    }

/*
Calculation functions
    Three functions for performing simple calculations
    1) timeStepGen, used by the animation function to get next time step
    2) rad2deg: converting radians to degrees, used to display angle in diagram & for plotting since plot needs degrees and calculations are in radians
    3) deg2rad: converting degrees to radians, used since calculation needs radians and the animation positions are in degrees.
*/
    function* timeStepGen(startIndex, stopIndex){
        let i=startIndex;
        let setIndex;
        while (true){
            if(typeof setIndex != 'undefined'){ //user has called .next(setIndex)
                i=setIndex;
                setIndex=yield i;
                if(animationState.isRunning || animationState.isStepping){i++;}
            }
            
            if(animationState.isRunning || animationState.isStepping){
                //reset the index if at the end else produec the next step. 
                if(i>stopIndex){i=startIndex;}
                
                setIndex=yield i;  // only set when user calls .next(setIndex). setindex is undefined when .next() is called
                i++;
            } else{
                 if(typeof setIndex != 'undefined'){ //user has called .next(setIndex) again while setindex was selected.
                    i=setIndex;
                }
                setIndex=yield i;
            }
        }
    }

    function rad2deg(NumRad){
        return NumRad*360/(2*math.pi)
    }

    function deg2rad(NumDeg){
        return NumDeg*(2*math.pi)/360
    }

    //Change the text on the SVG image
    function updateSVGTxt(circuitParam){    
        //setting  Supply outputs text ( see  circuitSVG object for details, ordering matches this object)
        circuitSVG.realPowerSupplyText.textContent=String(circuitParam.loadRealPower.toFixed(1)).concat(" W");
        circuitSVG.reactivePowerSupplyText.textContent=String(circuitParam.supplyReactivePower.toFixed(1)).concat(" VAr");
        circuitSVG.currentSupplyText.textContent=String(circuitParam.supplyIrms.toFixed(3)).concat("\u2220".concat(String(rad2deg(circuitParam.supplyAngI).toFixed(1)))).concat("\u00B0  A");
        
        circuitSVG.sFieldText.textContent=String(circuitParam.supplyApparentPower.toFixed(1)).concat(" VA");
            //Unit for PF
            let leadLagTxt;
            if (circuitParam.supplyAngPF<0){
                leadLagTxt=" Lead";
                } else{
                    leadLagTxt=" Lag";
            }
            
            if(1-math.abs(circuitParam.supplyPowerFactor)<0.005) {
                leadLagTxt=' Unity';
            }
            
        circuitSVG.pfFieldText.textContent=String(circuitParam.supplyPowerFactor.toFixed(3)).concat(leadLagTxt)

        //textelement for cap
        circuitSVG.capQText.textContent=String(circuitParam.capQ.toFixed(2)).concat(" VAr");
            
        //series and parallel text
        circuitSVG.parallelRTxt.textContent=String(circuitParam.loadRParallel.toFixed(1)).concat(' \u2126')
        circuitSVG.parallelXTxt.textContent=String(circuitParam.loadXParallel.toFixed(1)).concat(' \u2126')
            
        circuitSVG.seriesRTxt.textContent=String(circuitParam.loadRSeries.toFixed(1)).concat(' \u2126')
        circuitSVG.seriesXTxt.textContent=String(circuitParam.loadXSeries.toFixed(1)).concat(' \u2126')
    }
    

//  Load button response. changes which load circuit is displayed
    function changeCircuit(buttonClicked){
        //the case statements corrospond to the buttons id in the html
        switch(buttonClicked){
            case "hideLoad":        
            
                //changing svg elements
                circuitSVG.hideLoadGroup.removeAttribute("style");
                circuitSVG.seriesGroup.setAttribute("style", "display:none");
                circuitSVG.parallelGroup.setAttribute("style", "display:none");
                //changing button colours
                buttonLoadConfig.hideLoad.style.background=colourButtonActive;
                buttonLoadConfig.seriesLoad.style.background='';
                buttonLoadConfig.parallelLoad.style.background='';
            
                return true;
            case 'seriesLoad':
                circuitSVG.hideLoadGroup.setAttribute("style", "display:none");
                circuitSVG.seriesGroup.removeAttribute("style")
                circuitSVG.parallelGroup.setAttribute("style", "display:none");
            
                buttonLoadConfig.hideLoad.style.background='';
                buttonLoadConfig.seriesLoad.style.background=colourButtonActive;
                buttonLoadConfig.parallelLoad.style.background='';
            
                return true;
            case 'parallelLoad':
                circuitSVG.hideLoadGroup.setAttribute("style", "display:none");
                circuitSVG.seriesGroup.setAttribute("style", "display:none");
                circuitSVG.parallelGroup.removeAttribute("style")
                
                buttonLoadConfig.hideLoad.style.background='';
                buttonLoadConfig.seriesLoad.style.background='';
                buttonLoadConfig.parallelLoad.style.background=colourButtonActive;
                
                return true;
            default:
                console.log('Failed To Change Image. \n Expected input:MouseEvent. \n Input recieved:'.concat(buttonClicked))
                return false;
            }
    }

/*Animation buttons  response
This function sets the animation states by modifiers  two flags i) animationState.isStepping and ii) animationState.isRunning.
See animation function for more details on how these flags are used.
*/
    function animateState(stateSignal){
        //the statements corrospond to the buttons id in the html
        if  (stateSignal=="startAni"){
            if (!animationState.isRunning){
                animationState.isRunning=true; 
                window.requestAnimationFrame(animatePlot);
                  
                buttonAnimation.start.style.background=colourButtonActive;
                buttonAnimation.stop.style.background='';
                buttonAnimation.step.style.background='';
                buttonAnimation.resetZero.style.background='';
            }
        } else if (stateSignal=="stopAni"){
                animationState.isRunning=false;
            
                buttonAnimation.start.style.background='';
                buttonAnimation.stop.style.background=colourButtonActive;
                buttonAnimation.step.style.background='';
                buttonAnimation.resetZero.style.background='';
        } else if (stateSignal=="stepAni"){
          //stop the animation, allow one step.
          animationState.isRunning=false; animationState.isStepping=true;
          window.requestAnimationFrame(animatePlot);
     
                buttonAnimation.start.style.background='';
                buttonAnimation.stop.style.background='';
                buttonAnimation.step.style.background=colourButtonActive;
                buttonAnimation.resetZero.style.background='';
          //animatePlot is executed next draw cycle hence next draw cycle stepping is turned off. animateState.isStepping is set to true
        } else if(stateSignal=="resetZero"){
            //stop any animation in progress
            animationState.isRunning=false;

            //reseting the timeStep
            let currentTimeIndex=timeIndex.next(0).value;          

            updateCursorPhasor(QcompCircuit,currentTimeIndex)

            QcompCircuit.ThetaX=math.multiply(QcompCircuit.timeX, QcompCircuit.freq*360);
            // Redraw the figure, including axes using boxupdate
            animationState.boxUpdated=true; 
            //cancel any previous aimation frame before making a new one.
            window.requestAnimationFrame(animatePlot);
            
                buttonAnimation.start.style.background='';
                buttonAnimation.stop.style.background='';
                buttonAnimation.step.style.background='';
                buttonAnimation.resetZero.style.background=colourButtonActive;
                //wait some time (500ms) then turn the reset button off and the stop button on
                setTimeout(()=>{
                    buttonAnimation.resetZero.style.background='';
                    buttonAnimation.stop.style.background=colourButtonActive;
                }, 200) 
        }
    }

/*.Creating the three datagroups for plotting 
    1) waveformData => contains voltage, & current time series
    2) phasorData => contains voltage and current RMS&angle
    3) instantPower Data => contains p(t) and calc's the average power
*/
    function createWaveformData(Xvals,voltY1,currentY2 ){
        let rangeVoltage=[-400, 400];
        let rangeTime=[0, 0.04];
        let voltageWave={
            type: 'line',
             line:{color: '#1f77b4'}, // ensures it matches the axes color
            name: 'v(t)=&#8730;<span style="text-decoration:overline;">2</span>\u00D7'+'240' +'\u00D7' +'sin(2' +'&#120587;'+'50t)',
            x: Xvals,
            y: voltY1,
            yaxis: "y1",
        };

        let currentWave={
            type: 'line',
            line:{color: '#ff7f0e'}, // ensures it matches the axes color
            name:'i(t)=&#8730;<span style="text-decoration:overline;">2</span>\u00D7'+'Irms'+'\u00D7' +'sin(2' +'&#120587;'+'50t'+ '-'+  '\u03A6)' ,
            x: Xvals, 
            y: currentY2,
            yaxis: "y2",
        };
        
        let cursorDotV={            
            mode: 'markers',
            name:"Voltage (V)",
            marker: { color: '#1f77b4', size: 10,  line: {color: '#1f77b4',width: 2 }},
            showlegend: false,
            x: [Xvals[0]],
            y: [voltY1[0]],
            yaxis: "y1"
        }
        
        let cursorDotI={            
            mode: 'markers',
            name:"Current (A)",
            marker: { color: '#ff7f0e', size: 10,  line: {color: '#ff7f0e',width: 2  }},
            showlegend: false,
            x: [Xvals[0]],
            y: [currentY2[0]],
            yaxis: "y2"
        }
        
        let waveformData=[voltageWave, currentWave,cursorDotV, cursorDotI]
        
        let cursorLine={
            type:'line',
            line:{color: '#000000', width: 4},
            yref:'paper',
            y0: 0,
            y1: 1,
            x0: Xvals[0],
            x1: Xvals[0],
            layer: 'below'
        }
        let waveformLayout={
            xaxis:{title:"Time (seconds)", autorange:false, range:rangeTime},
            yaxis: {title:  "Voltage (V)" , color:'#1f77b4',autorange:false, range:rangeVoltage, zeroline: true,zerolinecolor: '#000000'},
            yaxis2: { title:"Current (A)",  overlaying: 'y', side: 'right', color:'#ff7f0e',showline:true,autorange:false, range:[-2, 2 ], zeroline: true,zerolinecolor: '#000000'},
            dragmode: false,
            hovermode: "x unified",
            legend: {x: 0, y:1.2},
            shapes:[cursorLine]
        };
        return [waveformData,waveformLayout]
    }

    //setting up the phasor information for plotting
    function createPhasorData(volt,cur, curAng){
        let V_Phasor={
            type: 'scatterpolar',
            mode:'line',
            name: '<b>V</b>=240' +'\u00D7' + 'exp(j2' +'&#120587;'+'50t)',
            r: [0 ,volt],
            theta: [0, 0],
            subplot: 'polar1'
        };

        let I_Phasor={
            type: 'scatterpolar',
            name: '<b>I</b>='+'Irms' +'\u00D7'+'exp(j2' +'&#120587;'+'50t'+ '-'+'\u03A6)',
            mode:'line',
            r:[0 ,cur],
            theta: [0 ,rad2deg(curAng)],
             subplot: 'polar2'
        };
        
        //component the current in phase with V (called Iv).    cos(angle I)=Iv/|I|  hence Iv=|I| cos(angle I)
        let IinPhaseV={
            type: 'scatterpolar',
            mode:'markers',
            name: '<b>I</b> component in phase with <b>V</b>',
            r: [ cur*math.cos(curAng)],
            theta: [0],
            subplot: 'polar2',
        };
        
        let phasorData=[V_Phasor,I_Phasor,IinPhaseV];

        let phasorLayout={
            dragmode: false,
            legend:{x: 0, y:1.5},
                /*Current 2 radial axes on 1 angular axes is not supported. 
                Solution: Plot 2 polar plots ontop of eachother (using domaina and remove the axes from the second one.*/
            polar: {
                domain:{x: [0, 1], y: [0,1]},
                radialaxis: {visible: false, range:[0, 283]} //range set based on the waveform range of -400 to 400
            },
            polar2: {
                domain:{ x: [0, 1], y: [0,1] },  
                //disable all ticks/labels on the second polar axes before it is overlayed on the first
                bgcolor:'rgba(0,0,0,0)',
                radialaxis: {visible: false, range:[0, 1.414]},
                angularaxis: { visible: false},
            }
        };
        return [phasorData, phasorLayout]
    }

    //setting up power data
    function createIntantPower(Xvals,PowerY){
        let rangeTime=[0, 0.04];
        
        let instantPower={
            type: 'line',
            line:{color:'#17becf'},
            name: "Instantaneous Power p(t)",
            x: Xvals,
            y: PowerY
        };
        
        //extend the average power to fill the x vals
        let avgPw=math.multiply(math.mean(PowerY) , math.ones(Xvals.length));
        
        let averagePower={
            type: 'line',
            line:{color: '#2ca02c'},
            name: "Average Power (P)",
            x: Xvals,
            y: avgPw
        };
        
        
        let cursorDotInst={            
            mode: 'markers',
            name:"Instantaneous Power (W)",
            marker: { color: '#17becf', size: 15},
            showlegend: false,
            x: [Xvals[0]],
            y: [PowerY[0]]
        }
        let cursorDotAver={            
            mode: 'markers',
            name:"Average Power (W)",
            marker: { color: '#2ca02c', size: 15},
            showlegend: false,
            x: [Xvals[0]],
            y: [avgPw[0]]
        }
        
        let instantaneousPower=[instantPower, averagePower, cursorDotInst, cursorDotAver];
        
        
        let cursorLine={ //this is added to the layout as a shape and not as a waveform output
            type:'line',
            line:{color: '#000000', width: 4},
            yref:'paper',
            y0: 0,
            y1: 1,
            x0: Xvals[0],
            x1: Xvals[0],
            layer: 'below'
        };
        
        let instantaneousPowerLayout={
            xaxis:{title:"Time (seconds)", autorange:false,  range:rangeTime, fixedrange: true},
            yaxis: {title: 'Instantaneous Power (W)'},
            dragmode: false,
            hovermode: "x unified",
            legend:{x: 0, y:1.2},
            //create a cursor line
            shapes: [cursorLine]
        };
        
        return [instantaneousPower, instantaneousPowerLayout]
    }

    function createPowerTriangle(RealPower,ReactivePower,ApparentPower){
       let realPowerArrow={
           type: 'line',
           line:{color: '#2ca02c'} ,
           name: "Real Power (P)",
           x:   [0, RealPower],
           y:   [0, 0]
       };
       
       let reactivePowerArrow={
           type: 'line',
           line:{color:'#9467bd'},
           name: "Reactive Power (Q)",
           x:   [1,1].fill(RealPower),
           y:   [0, ReactivePower]
       };
       
      let apparentPowerArrow={
            type: 'line',
            line:{color:'#8c564b'},
            name: "Apparent Power (S)",
            x:   [0, RealPower],
            y:   [0, ReactivePower]
        };
        
        let powerTriangle=[realPowerArrow, reactivePowerArrow,apparentPowerArrow];
        
        let powerTriangleLayout={
            legend:{x: 0, y:1.2},
            xaxis:{title:"Real Power (W)",autorange:false, range:[0, 200]},
            yaxis: {title: 'Reactive Power (Q)',autorange:false, range:[-100, 200]},
            dragmode: false
        };
        return [powerTriangle, powerTriangleLayout]
    }
    
})();