#include "new_action_1743416048738/temoto_action.hpp"

class NewAction_1743416048738 : public TemotoAction
{
public:

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * REQUIRED class methods, do not remove them
 *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

NewAction_1743416048738()
{
}

bool onRun()
{
  TEMOTO_PRINT_OF("Running", getName());

  /*
   * Implement your code here
   *
   * Access input parameters via "params_in" member
   * Set output parameters via "params_out" member
   */

  return true;
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * OPTIONAL class methods, can be removed if not needed
 *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

void onInit()
{
  TEMOTO_PRINT_OF("Initializing", getName());
}

void onPause()
{
  TEMOTO_PRINT_OF("Pausing", getName());
}

void onResume()
{
  TEMOTO_PRINT_OF("Continuing", getName());
}

void onStop()
{
  TEMOTO_PRINT_OF("Stopping", getName());
}

~NewAction_1743416048738()
{
}

}; // NewAction_1743416048738 class

// REQUIRED, do not remove
boost::shared_ptr<ActionBase> factory()
{
    return boost::shared_ptr<NewAction_1743416048738>(new NewAction_1743416048738());
}

// REQUIRED, do not remove
BOOST_DLL_ALIAS(factory, NewAction_1743416048738)